-- Update check_capacity_with_plan to use subscription_usage active counts
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
AS $$
DECLARE
  v_active_managers integer;
  v_active_workers integer;
  v_max_managers integer;
  v_max_workers integer;
  v_planned_managers integer;
  v_planned_workers integer;
  v_plan_name text;
  v_subscription_status text;
  current_month date;
BEGIN
  current_month := date_trunc('month', CURRENT_DATE);
  
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
  
  -- Get active counts and planned capacity from current month's subscription_usage
  SELECT 
    COALESCE(su.active_managers, 0),
    COALESCE(su.active_workers, 0),
    COALESCE(su.planned_number_of_managers, 0),
    COALESCE(su.planned_number_of_workers, 0)
  INTO v_active_managers, v_active_workers, v_planned_managers, v_planned_workers
  FROM subscription_usage su
  WHERE su.organization_id = org_id
    AND su.month = current_month
  LIMIT 1;
  
  -- If no subscription_usage row exists, return all zeros and disallow
  IF NOT FOUND THEN
    v_active_managers := 0;
    v_active_workers := 0;
    v_planned_managers := 0;
    v_planned_workers := 0;
  END IF;
  
  -- Determine plan name based on limits
  IF v_subscription_status = 'trial' THEN
    v_plan_name := 'Trial';
  ELSIF v_max_managers = 2 AND v_max_workers = 10 THEN
    v_plan_name := 'Starter';
  ELSIF v_max_managers = 5 AND v_max_workers = 100 THEN
    v_plan_name := 'Pro';
  ELSIF v_max_managers > 5 OR v_max_managers = 999999 THEN
    v_plan_name := 'Enterprise';
  ELSE
    v_plan_name := 'Custom';
  END IF;
  
  -- Return capacity check results
  -- can_add = active < LEAST(max, planned)
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
$$;