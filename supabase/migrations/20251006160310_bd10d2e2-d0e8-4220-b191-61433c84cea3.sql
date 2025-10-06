-- First, clean up duplicate rows (keep the most recent one per org/month)
DELETE FROM subscription_usage
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY organization_id, date_trunc('month', month)
             ORDER BY created_at DESC
           ) as rn
    FROM subscription_usage
  ) sub
  WHERE rn > 1
);

-- Drop ALL triggers on managers and workers tables that might depend on the functions
DROP TRIGGER IF EXISTS enforce_manager_limit ON managers;
DROP TRIGGER IF EXISTS enforce_worker_limit ON workers;
DROP TRIGGER IF EXISTS trg_managers_enforce ON managers;
DROP TRIGGER IF EXISTS trg_workers_enforce ON workers;

-- Now drop the functions
DROP FUNCTION IF EXISTS ensure_usage_row(uuid);
DROP FUNCTION IF EXISTS enforce_and_increment_manager_limit();
DROP FUNCTION IF EXISTS enforce_and_increment_worker_limit();

-- Recreate ensure_usage_row with consistent date handling
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
BEGIN
  -- Check if row already exists for this month
  SELECT EXISTS (
    SELECT 1 FROM subscription_usage
    WHERE organization_id = p_org
      AND month = v_month
  ) INTO v_exists;

  -- If row exists, do nothing
  IF v_exists THEN
    RETURN;
  END IF;

  -- Get plan limits for this month
  SELECT planned_managers, planned_workers
    INTO v_pm, v_pw
  FROM get_plan_limits(p_org, v_month);

  -- Get previous active counts from most recent row
  SELECT su.active_managers, su.active_workers
    INTO v_prev_active_m, v_prev_active_w
  FROM subscription_usage su
  WHERE su.organization_id = p_org
  ORDER BY su.month DESC
  LIMIT 1;

  -- Fall back to counting from base tables if no previous record
  IF v_prev_active_m IS NULL THEN
    SELECT count(*) INTO v_prev_active_m FROM managers WHERE organization_id = p_org;
  END IF;
  
  IF v_prev_active_w IS NULL THEN
    SELECT count(*) INTO v_prev_active_w FROM workers WHERE organization_id = p_org;
  END IF;

  -- Insert new row for current month
  INSERT INTO subscription_usage (
    organization_id, month,
    planned_number_of_managers, planned_number_of_workers,
    active_managers, active_workers
  )
  VALUES (p_org, v_month, v_pm, v_pw, v_prev_active_m, v_prev_active_w);
END$function$;

-- Recreate enforce_and_increment_manager_limit with CURRENT_DATE
CREATE OR REPLACE FUNCTION public.enforce_and_increment_manager_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row subscription_usage;
  v_month date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  PERFORM ensure_usage_row(NEW.organization_id);

  SELECT * INTO v_row
  FROM subscription_usage
  WHERE organization_id = NEW.organization_id
    AND month = v_month
  FOR UPDATE;

  -- Skip check when planned is NULL (Enterprise/Unlimited)
  IF v_row.planned_number_of_managers IS NOT NULL
     AND v_row.active_managers >= v_row.planned_number_of_managers THEN
    RAISE EXCEPTION 'Manager limit reached for organization % (active % / planned %)',
      NEW.organization_id, v_row.active_managers, v_row.planned_number_of_managers
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE subscription_usage
     SET active_managers = active_managers + 1
   WHERE organization_id = NEW.organization_id
     AND month = v_month;

  RETURN NEW;
END$function$;

-- Recreate enforce_and_increment_worker_limit with CURRENT_DATE
CREATE OR REPLACE FUNCTION public.enforce_and_increment_worker_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row subscription_usage;
  v_month date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  PERFORM ensure_usage_row(NEW.organization_id);

  SELECT * INTO v_row
  FROM subscription_usage
  WHERE organization_id = NEW.organization_id
    AND month = v_month
  FOR UPDATE;

  -- Skip check when planned is NULL (Enterprise/Unlimited)
  IF v_row.planned_number_of_workers IS NOT NULL
     AND v_row.active_workers >= v_row.planned_number_of_workers THEN
    RAISE EXCEPTION 'Worker limit reached for organization % (active % / planned %)',
      NEW.organization_id, v_row.active_workers, v_row.planned_number_of_workers
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE subscription_usage
     SET active_workers = active_workers + 1
   WHERE organization_id = NEW.organization_id
     AND month = v_month;

  RETURN NEW;
END$function$;

-- Recreate the triggers
CREATE TRIGGER trg_managers_enforce
  BEFORE INSERT ON managers
  FOR EACH ROW
  EXECUTE FUNCTION enforce_and_increment_manager_limit();

CREATE TRIGGER trg_workers_enforce
  BEFORE INSERT ON workers
  FOR EACH ROW
  EXECUTE FUNCTION enforce_and_increment_worker_limit();