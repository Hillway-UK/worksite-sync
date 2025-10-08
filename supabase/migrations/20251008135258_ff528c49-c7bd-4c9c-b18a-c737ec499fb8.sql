-- Drop the max_managers and max_workers columns from organizations table
-- and update all functions to use only subscription_usage data

-- 1. Update check_capacity_with_plan to use only subscription_usage
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
) AS $$
DECLARE
  v_active_managers integer;
  v_active_workers integer;
  v_planned_managers integer;
  v_planned_workers integer;
  v_plan_name text;
BEGIN
  -- Get active counts and planned capacity from subscription_usage
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
  
  -- For unlimited plans (NULL or 999999), convert to 999999
  IF v_planned_managers IS NULL THEN
    v_planned_managers := 999999;
  END IF;
  
  IF v_planned_workers IS NULL THEN
    v_planned_workers := 999999;
  END IF;
  
  -- Return capacity check results
  -- max_managers and max_workers now return the same as planned (for compatibility)
  RETURN QUERY SELECT
    (v_active_managers < v_planned_managers)::boolean,
    (v_active_workers < v_planned_workers)::boolean,
    v_active_managers,
    v_active_workers,
    v_planned_managers, -- max_managers now equals planned_managers
    v_planned_workers,  -- max_workers now equals planned_workers
    v_planned_managers,
    v_planned_workers,
    v_plan_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Update upgrade_subscription_plan to only update subscription_usage
CREATE OR REPLACE FUNCTION public.upgrade_subscription_plan(
  p_org_id uuid,
  p_new_max_managers integer,
  p_new_max_workers integer,
  p_plan_type text
)
RETURNS uuid AS $$
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

  -- Only update organization status and dates (NOT max values)
  UPDATE organizations
  SET 
    subscription_status = CASE
      WHEN p_plan_type = 'trial' THEN 'trial'
      ELSE 'active'
    END,
    subscription_start_date = CURRENT_DATE,
    updated_at = now()
  WHERE id = p_org_id;

  RETURN v_new_row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Update ensure_usage_row to not read from organizations
CREATE OR REPLACE FUNCTION public.ensure_usage_row(p_org uuid)
RETURNS void AS $$
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

  -- Get previous subscription data
  SELECT 
    su.planned_number_of_managers,
    su.planned_number_of_workers,
    su.active_managers,
    su.active_workers,
    su.plan_type
  INTO v_pm, v_pw, v_prev_active_m, v_prev_active_w, v_plan_type
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

  -- Use default trial plan if no previous plan exists
  IF v_pm IS NULL THEN v_pm := 1; END IF;
  IF v_pw IS NULL THEN v_pw := 3; END IF;
  IF v_plan_type IS NULL THEN v_plan_type := 'trial'; END IF;

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Drop get_plan_limits function as it's no longer needed
DROP FUNCTION IF EXISTS public.get_plan_limits(uuid, date);

-- 5. Drop the max_managers and max_workers columns from organizations
ALTER TABLE organizations DROP COLUMN IF EXISTS max_managers;
ALTER TABLE organizations DROP COLUMN IF EXISTS max_workers;