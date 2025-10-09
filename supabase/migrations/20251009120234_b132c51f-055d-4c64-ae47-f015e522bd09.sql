-- Phase 1: Create subscription audit log table
CREATE TABLE IF NOT EXISTS subscription_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  action text NOT NULL,
  before_count integer,
  after_count integer,
  trigger_source text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Super admins can view audit logs for their organization
CREATE POLICY "Super admins can view org audit logs"
ON subscription_audit_log FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM super_admins WHERE email = auth.email()
  )
);

-- Service role can manage audit logs
CREATE POLICY "Service role can manage audit logs"
ON subscription_audit_log FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Phase 2: Update enforce_and_increment_worker_limit with logging
CREATE OR REPLACE FUNCTION public.enforce_and_increment_worker_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row subscription_usage;
  v_before_count integer;
BEGIN
  PERFORM ensure_usage_row(NEW.organization_id);

  SELECT * INTO v_row
  FROM subscription_usage
  WHERE organization_id = NEW.organization_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active subscription found for organization %', NEW.organization_id;
  END IF;

  -- Store before count for logging
  v_before_count := v_row.active_workers;

  -- Skip check when planned is NULL (Enterprise/Unlimited)
  IF v_row.planned_number_of_workers IS NOT NULL
     AND v_row.active_workers >= v_row.planned_number_of_workers THEN
    -- Log the rejection
    INSERT INTO subscription_audit_log (
      organization_id, action, before_count, after_count, 
      trigger_source, metadata
    ) VALUES (
      NEW.organization_id, 'worker_add_rejected', v_before_count, v_before_count,
      'db_trigger', 
      jsonb_build_object(
        'worker_id', NEW.id,
        'reason', 'limit_reached',
        'planned', v_row.planned_number_of_workers
      )
    );
    
    RAISE EXCEPTION 'Worker limit reached for organization % (active % / planned %)',
      NEW.organization_id, v_row.active_workers, v_row.planned_number_of_workers
      USING ERRCODE = 'check_violation';
  END IF;

  -- Increment the counter
  UPDATE subscription_usage
     SET active_workers = active_workers + 1
   WHERE id = v_row.id;

  -- Log the successful increment
  INSERT INTO subscription_audit_log (
    organization_id, action, before_count, after_count, 
    trigger_source, metadata
  ) VALUES (
    NEW.organization_id, 'worker_added', v_before_count, v_before_count + 1,
    'db_trigger', 
    jsonb_build_object('worker_id', NEW.id, 'worker_name', NEW.name)
  );

  RETURN NEW;
END;
$function$;

-- Phase 3: Update decrement_active_workers with logging
CREATE OR REPLACE FUNCTION public.decrement_active_workers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_before_count integer;
  v_after_count integer;
BEGIN
  -- Get before count
  SELECT active_workers INTO v_before_count
  FROM subscription_usage
  WHERE organization_id = OLD.organization_id
    AND status = 'active';

  -- Decrement
  UPDATE subscription_usage
  SET active_workers = GREATEST(active_workers - 1, 0)
  WHERE organization_id = OLD.organization_id
    AND status = 'active'
  RETURNING active_workers INTO v_after_count;

  -- Log the decrement
  INSERT INTO subscription_audit_log (
    organization_id, action, before_count, after_count, 
    trigger_source, metadata
  ) VALUES (
    OLD.organization_id, 'worker_removed', v_before_count, v_after_count,
    'db_trigger', 
    jsonb_build_object('worker_id', OLD.id, 'worker_name', OLD.name)
  );
  
  RETURN OLD;
END;
$function$;

-- Phase 4: Update decrement_active_managers with logging (for consistency)
CREATE OR REPLACE FUNCTION public.decrement_active_managers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_before_count integer;
  v_after_count integer;
BEGIN
  -- Get before count
  SELECT active_managers INTO v_before_count
  FROM subscription_usage
  WHERE organization_id = OLD.organization_id
    AND status = 'active';

  -- Decrement
  UPDATE subscription_usage
  SET active_managers = GREATEST(active_managers - 1, 0)
  WHERE organization_id = OLD.organization_id
    AND status = 'active'
  RETURNING active_managers INTO v_after_count;

  -- Log the decrement
  INSERT INTO subscription_audit_log (
    organization_id, action, before_count, after_count, 
    trigger_source, metadata
  ) VALUES (
    OLD.organization_id, 'manager_removed', v_before_count, v_after_count,
    'db_trigger', 
    jsonb_build_object('manager_id', OLD.id, 'manager_name', OLD.name)
  );
  
  RETURN OLD;
END;
$function$;

-- Phase 5: Create validation function
CREATE OR REPLACE FUNCTION public.validate_subscription_counts()
RETURNS TABLE(
  organization_id uuid,
  organization_name text,
  expected_workers integer,
  recorded_workers integer,
  worker_discrepancy integer,
  expected_managers integer,
  recorded_managers integer,
  manager_discrepancy integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    o.id as organization_id,
    o.name as organization_name,
    COUNT(DISTINCT w.id)::integer as expected_workers,
    COALESCE(su.active_workers, 0) as recorded_workers,
    (COUNT(DISTINCT w.id) - COALESCE(su.active_workers, 0))::integer as worker_discrepancy,
    COUNT(DISTINCT m.id)::integer as expected_managers,
    COALESCE(su.active_managers, 0) as recorded_managers,
    (COUNT(DISTINCT m.id) - COALESCE(su.active_managers, 0))::integer as manager_discrepancy
  FROM organizations o
  LEFT JOIN workers w ON w.organization_id = o.id
  LEFT JOIN managers m ON m.organization_id = o.id
  LEFT JOIN subscription_usage su ON su.organization_id = o.id AND su.status = 'active'
  GROUP BY o.id, o.name, su.active_workers, su.active_managers
  HAVING 
    COUNT(DISTINCT w.id) != COALESCE(su.active_workers, 0)
    OR COUNT(DISTINCT m.id) != COALESCE(su.active_managers, 0);
$function$;

-- Phase 6: Add pg_cron job for hourly reconciliation
SELECT cron.schedule(
  'hourly-subscription-reconciliation',
  '0 * * * *',
  $$
  INSERT INTO subscription_audit_log (organization_id, action, before_count, after_count, trigger_source, metadata)
  SELECT 
    org_id,
    'reconciliation',
    old_workers,
    new_workers,
    'cron_job',
    jsonb_build_object(
      'org_name', org_name,
      'old_managers', old_managers,
      'new_managers', new_managers
    )
  FROM reconcile_subscription_usage();
  $$
);