-- Create enhanced capacity check function that counts actual managers/workers
-- and compares against both max limits and planned capacity
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
  v_current_managers integer;
  v_current_workers integer;
  v_max_managers integer;
  v_max_workers integer;
  v_planned_managers integer;
  v_planned_workers integer;
  v_plan_name text;
  v_subscription_status text;
BEGIN
  -- Count actual managers and workers
  SELECT COUNT(*) INTO v_current_managers
  FROM managers m
  WHERE m.organization_id = org_id;
  
  SELECT COUNT(*) INTO v_current_workers
  FROM workers w
  WHERE w.organization_id = org_id;
  
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
  
  -- Get planned capacity from current month's subscription_usage
  SELECT 
    COALESCE(su.planned_number_of_managers, 0),
    COALESCE(su.planned_number_of_workers, 0)
  INTO v_planned_managers, v_planned_workers
  FROM subscription_usage su
  WHERE su.organization_id = org_id
    AND su.month >= date_trunc('month', CURRENT_DATE)
  ORDER BY su.month DESC
  LIMIT 1;
  
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
  RETURN QUERY SELECT
    (v_current_managers < LEAST(v_max_managers, v_planned_managers))::boolean,
    (v_current_workers < LEAST(v_max_workers, v_planned_workers))::boolean,
    v_current_managers,
    v_current_workers,
    v_max_managers,
    v_max_workers,
    v_planned_managers,
    v_planned_workers,
    v_plan_name;
END;
$$;