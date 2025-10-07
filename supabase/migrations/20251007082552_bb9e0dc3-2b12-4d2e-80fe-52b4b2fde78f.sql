-- Add new columns to subscription_usage table for mid-cycle upgrades
ALTER TABLE subscription_usage
ADD COLUMN status text NOT NULL DEFAULT 'active',
ADD COLUMN effective_start_date date,
ADD COLUMN effective_end_date date,
ADD COLUMN plan_type text,
ADD COLUMN superseded_by uuid REFERENCES subscription_usage(id);

-- Add check constraint for status values
ALTER TABLE subscription_usage
ADD CONSTRAINT subscription_usage_status_check 
CHECK (status IN ('active', 'expired', 'upcoming'));

-- Set effective_start_date for existing rows (use month as start date)
UPDATE subscription_usage
SET effective_start_date = month
WHERE effective_start_date IS NULL;

-- Make effective_start_date not nullable after setting values
ALTER TABLE subscription_usage
ALTER COLUMN effective_start_date SET NOT NULL;

-- Derive plan_type from max_managers and max_workers for existing rows
UPDATE subscription_usage su
SET plan_type = CASE
  WHEN o.subscription_status = 'trial' THEN 'trial'
  WHEN o.max_managers = 2 AND o.max_workers = 10 THEN 'starter'
  WHEN o.max_managers = 5 AND o.max_workers = 100 THEN 'pro'
  WHEN o.max_managers > 5 OR o.max_managers = 999999 THEN 'enterprise'
  ELSE 'custom'
END
FROM organizations o
WHERE su.organization_id = o.id
AND su.plan_type IS NULL;

-- Create index on status for faster queries
CREATE INDEX idx_subscription_usage_status ON subscription_usage(organization_id, status);

-- Create index on effective dates
CREATE INDEX idx_subscription_usage_dates ON subscription_usage(organization_id, effective_start_date, effective_end_date);

-- Update ensure_usage_row to work with status-based logic
CREATE OR REPLACE FUNCTION public.ensure_usage_row(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month date := date_trunc('month', CURRENT_DATE)::date;
  v_prev_active_m int;
  v_prev_active_w int;
  v_pm int;
  v_pw int;
  v_exists boolean;
  v_plan_type text;
BEGIN
  -- Check if there's already an active row for this organization
  SELECT EXISTS (
    SELECT 1 FROM subscription_usage
    WHERE organization_id = p_org
      AND status = 'active'
  ) INTO v_exists;

  -- If active row exists, do nothing
  IF v_exists THEN
    RETURN;
  END IF;

  -- Get plan limits and type
  SELECT 
    CASE 
      WHEN o.max_managers IS NULL OR o.max_managers >= 999999 THEN NULL
      ELSE o.max_managers
    END,
    CASE 
      WHEN o.max_workers IS NULL OR o.max_workers >= 999999 THEN NULL
      ELSE o.max_workers
    END,
    CASE
      WHEN o.subscription_status = 'trial' THEN 'trial'
      WHEN o.max_managers = 2 AND o.max_workers = 10 THEN 'starter'
      WHEN o.max_managers = 5 AND o.max_workers = 100 THEN 'pro'
      WHEN o.max_managers > 5 OR o.max_managers >= 999999 THEN 'enterprise'
      ELSE 'custom'
    END
  INTO v_pm, v_pw, v_plan_type
  FROM organizations o
  WHERE o.id = p_org;

  -- Get previous active counts from most recent row
  SELECT su.active_managers, su.active_workers
    INTO v_prev_active_m, v_prev_active_w
  FROM subscription_usage su
  WHERE su.organization_id = p_org
  ORDER BY su.created_at DESC
  LIMIT 1;

  -- Fall back to counting from base tables if no previous record
  IF v_prev_active_m IS NULL THEN
    SELECT count(*) INTO v_prev_active_m FROM managers WHERE organization_id = p_org;
  END IF;
  
  IF v_prev_active_w IS NULL THEN
    SELECT count(*) INTO v_prev_active_w FROM workers WHERE organization_id = p_org;
  END IF;

  -- Insert new active row
  INSERT INTO subscription_usage (
    organization_id, month,
    planned_number_of_managers, planned_number_of_workers,
    active_managers, active_workers,
    status, effective_start_date, plan_type
  )
  VALUES (
    p_org, v_month, 
    v_pm, v_pw, 
    v_prev_active_m, v_prev_active_w,
    'active', CURRENT_DATE, v_plan_type
  );
END$function$;

-- Create function to upgrade subscription plan mid-cycle
CREATE OR REPLACE FUNCTION public.upgrade_subscription_plan(
  p_org_id uuid,
  p_new_max_managers integer,
  p_new_max_workers integer,
  p_plan_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_row subscription_usage;
  v_new_row_id uuid;
  v_new_month date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  -- Get the current active subscription_usage row
  SELECT * INTO v_current_row
  FROM subscription_usage
  WHERE organization_id = p_org_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active subscription found for organization %', p_org_id;
  END IF;

  -- Mark current row as expired
  UPDATE subscription_usage
  SET 
    status = 'expired',
    effective_end_date = CURRENT_DATE
  WHERE id = v_current_row.id;

  -- Create new active subscription_usage row
  INSERT INTO subscription_usage (
    organization_id,
    month,
    planned_number_of_managers,
    planned_number_of_workers,
    active_managers,
    active_workers,
    status,
    effective_start_date,
    plan_type
  )
  VALUES (
    p_org_id,
    v_new_month,
    p_new_max_managers,
    p_new_max_workers,
    v_current_row.active_managers,
    v_current_row.active_workers,
    'active',
    CURRENT_DATE,
    p_plan_type
  )
  RETURNING id INTO v_new_row_id;

  -- Link old row to new row
  UPDATE subscription_usage
  SET superseded_by = v_new_row_id
  WHERE id = v_current_row.id;

  -- Update organizations table with new limits
  UPDATE organizations
  SET 
    max_managers = p_new_max_managers,
    max_workers = p_new_max_workers,
    subscription_status = CASE
      WHEN p_plan_type = 'trial' THEN 'trial'
      ELSE 'active'
    END,
    subscription_start_date = CURRENT_DATE,
    updated_at = now()
  WHERE id = p_org_id;

  RETURN v_new_row_id;
END;
$function$;

-- Update check_capacity_with_plan to use active status
CREATE OR REPLACE FUNCTION public.check_capacity_with_plan(org_id uuid)
RETURNS TABLE(
  can_add_manager boolean, 
  can_add_worker boolean, 
  current_manager_count integer, 
  current_worker_count integer, 
  max_managers integer, 
  max_workers integer, 
  planned_managers integer, 
  planned_workers integer, 
  plan_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_active_managers integer;
  v_active_workers integer;
  v_max_managers integer;
  v_max_workers integer;
  v_planned_managers integer;
  v_planned_workers integer;
  v_plan_name text;
  v_subscription_status text;
BEGIN
  -- Get organization limits and subscription status
  SELECT o.max_managers, o.max_workers, o.subscription_status
  INTO v_max_managers, v_max_workers, v_subscription_status
  FROM organizations o
  WHERE o.id = org_id;
  
  -- Handle null max values (Enterprise plan - unlimited)
  IF v_max_managers IS NULL THEN
    v_max_managers := 999999;
  END IF;
  
  IF v_max_workers IS NULL THEN
    v_max_workers := 999999;
  END IF;
  
  -- Get active counts and planned capacity from active subscription_usage
  SELECT 
    COALESCE(su.active_managers, 0),
    COALESCE(su.active_workers, 0),
    COALESCE(su.planned_number_of_managers, 0),
    COALESCE(su.planned_number_of_workers, 0),
    COALESCE(su.plan_type, 'unknown')
  INTO v_active_managers, v_active_workers, v_planned_managers, v_planned_workers, v_plan_name
  FROM subscription_usage su
  WHERE su.organization_id = org_id
    AND su.status = 'active'
  LIMIT 1;
  
  -- If no active subscription_usage row exists, return zeros and disallow
  IF NOT FOUND THEN
    v_active_managers := 0;
    v_active_workers := 0;
    v_planned_managers := 0;
    v_planned_workers := 0;
    v_plan_name := 'none';
  END IF;
  
  -- Return capacity check results
  RETURN QUERY SELECT
    (v_active_managers < LEAST(v_max_managers, v_planned_managers))::boolean,
    (v_active_workers < LEAST(v_max_workers, v_planned_workers))::boolean,
    v_active_managers,
    v_active_workers,
    v_max_managers,
    v_max_workers,
    v_planned_managers,
    v_planned_workers,
    v_plan_name;
END;
$function$;

-- Update enforce_and_increment_manager_limit to use active status
CREATE OR REPLACE FUNCTION public.enforce_and_increment_manager_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row subscription_usage;
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

  -- Skip check when planned is NULL (Enterprise/Unlimited)
  IF v_row.planned_number_of_managers IS NOT NULL
     AND v_row.active_managers >= v_row.planned_number_of_managers THEN
    RAISE EXCEPTION 'Manager limit reached for organization % (active % / planned %)',
      NEW.organization_id, v_row.active_managers, v_row.planned_number_of_managers
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE subscription_usage
     SET active_managers = active_managers + 1
   WHERE id = v_row.id;

  RETURN NEW;
END$function$;

-- Update enforce_and_increment_worker_limit to use active status
CREATE OR REPLACE FUNCTION public.enforce_and_increment_worker_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row subscription_usage;
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

  -- Skip check when planned is NULL (Enterprise/Unlimited)
  IF v_row.planned_number_of_workers IS NOT NULL
     AND v_row.active_workers >= v_row.planned_number_of_workers THEN
    RAISE EXCEPTION 'Worker limit reached for organization % (active % / planned %)',
      NEW.organization_id, v_row.active_workers, v_row.planned_number_of_workers
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE subscription_usage
     SET active_workers = active_workers + 1
   WHERE id = v_row.id;

  RETURN NEW;
END$function$;

-- Update decrement functions to use active status
CREATE OR REPLACE FUNCTION public.decrement_active_managers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE subscription_usage
  SET active_managers = GREATEST(active_managers - 1, 0)
  WHERE organization_id = OLD.organization_id
    AND status = 'active';
  
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrement_active_workers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE subscription_usage
  SET active_workers = GREATEST(active_workers - 1, 0)
  WHERE organization_id = OLD.organization_id
    AND status = 'active';
  
  RETURN OLD;
END;
$function$;

-- Create helper function to get active subscription
CREATE OR REPLACE FUNCTION public.get_active_subscription_usage(p_org_id uuid)
RETURNS subscription_usage
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT *
  FROM subscription_usage
  WHERE organization_id = p_org_id
    AND status = 'active'
  LIMIT 1;
$function$;