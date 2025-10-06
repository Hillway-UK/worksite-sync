-- 1) Create function to get plan limits from organizations table
-- Returns NULL for unlimited (Enterprise) plans
CREATE OR REPLACE FUNCTION get_plan_limits(p_org uuid, p_month date)
RETURNS TABLE(planned_managers int, planned_workers int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE 
      WHEN o.max_managers IS NULL OR o.max_managers >= 999999 THEN NULL
      ELSE o.max_managers
    END as planned_managers,
    CASE 
      WHEN o.max_workers IS NULL OR o.max_workers >= 999999 THEN NULL
      ELSE o.max_workers
    END as planned_workers
  FROM organizations o
  WHERE o.id = p_org
$$;

-- 2) Create function to ensure current month's usage row exists
-- Carries over active counts from previous month or seeds from actual tables
CREATE OR REPLACE FUNCTION ensure_usage_row(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', now())::date;
  v_prev_active_m int;
  v_prev_active_w int;
  v_pm int;
  v_pw int;
BEGIN
  -- Get plan limits for this month
  SELECT planned_managers, planned_workers
    INTO v_pm, v_pw
  FROM get_plan_limits(p_org, v_month);

  -- Prefer last recorded active_*; else, count from base tables
  SELECT su.active_managers, su.active_workers
    INTO v_prev_active_m, v_prev_active_w
  FROM subscription_usage su
  WHERE su.organization_id = p_org
  ORDER BY su.month DESC
  LIMIT 1;

  IF v_prev_active_m IS NULL THEN
    SELECT count(*) INTO v_prev_active_m FROM managers WHERE organization_id = p_org;
  END IF;
  
  IF v_prev_active_w IS NULL THEN
    SELECT count(*) INTO v_prev_active_w FROM workers WHERE organization_id = p_org;
  END IF;

  INSERT INTO subscription_usage (
    organization_id, month,
    planned_number_of_managers, planned_number_of_workers,
    active_managers, active_workers
  )
  VALUES (p_org, v_month, v_pm, v_pw, v_prev_active_m, v_prev_active_w)
  ON CONFLICT (organization_id, month) DO NOTHING;
END$$;

-- 3) Drop old increment triggers first
DROP TRIGGER IF EXISTS trg_increment_active_managers ON managers;
DROP TRIGGER IF EXISTS trg_increment_active_workers ON workers;
DROP TRIGGER IF EXISTS after_manager_insert ON managers;
DROP TRIGGER IF EXISTS after_worker_insert ON workers;

-- 4) Now drop the old functions
DROP FUNCTION IF EXISTS increment_active_managers();
DROP FUNCTION IF EXISTS increment_active_workers();

-- 5) Create enforcement function for managers
CREATE OR REPLACE FUNCTION enforce_and_increment_manager_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row subscription_usage;
  v_month date := date_trunc('month', now())::date;
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
END$$;

-- Create BEFORE INSERT trigger for managers
CREATE TRIGGER trg_managers_enforce
BEFORE INSERT ON managers
FOR EACH ROW
EXECUTE FUNCTION enforce_and_increment_manager_limit();

-- 6) Create enforcement function for workers
CREATE OR REPLACE FUNCTION enforce_and_increment_worker_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row subscription_usage;
  v_month date := date_trunc('month', now())::date;
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
END$$;

-- Create BEFORE INSERT trigger for workers
CREATE TRIGGER trg_workers_enforce
BEFORE INSERT ON workers
FOR EACH ROW
EXECUTE FUNCTION enforce_and_increment_worker_limit();