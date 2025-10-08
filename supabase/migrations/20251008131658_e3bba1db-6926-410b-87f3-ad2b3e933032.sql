-- Create reconciliation function to sync active counts with reality
CREATE OR REPLACE FUNCTION public.reconcile_subscription_usage()
RETURNS TABLE(
  org_id uuid,
  org_name text,
  old_managers int,
  new_managers int,
  old_workers int,
  new_workers int
) AS $$
BEGIN
  RETURN QUERY
  WITH actual_counts AS (
    SELECT 
      o.id as organization_id,
      o.name as organization_name,
      COUNT(DISTINCT m.id)::int as manager_count,
      COUNT(DISTINCT w.id)::int as worker_count
    FROM organizations o
    LEFT JOIN managers m ON m.organization_id = o.id
    LEFT JOIN workers w ON w.organization_id = o.id
    GROUP BY o.id, o.name
  ),
  old_values AS (
    SELECT 
      organization_id,
      active_managers,
      active_workers
    FROM subscription_usage
    WHERE status = 'active'
  ),
  updates AS (
    UPDATE subscription_usage su
    SET 
      active_managers = ac.manager_count,
      active_workers = ac.worker_count
      -- NOTE: total_cost is NOT updated
    FROM actual_counts ac
    WHERE su.organization_id = ac.organization_id
      AND su.status = 'active'
    RETURNING 
      su.organization_id,
      su.active_managers as new_active_managers,
      su.active_workers as new_active_workers
  )
  SELECT 
    ac.organization_id,
    ac.organization_name,
    COALESCE(ov.active_managers, 0)::int as old_managers,
    u.new_active_managers as new_managers,
    COALESCE(ov.active_workers, 0)::int as old_workers,
    u.new_active_workers as new_workers
  FROM actual_counts ac
  LEFT JOIN old_values ov ON ov.organization_id = ac.organization_id
  JOIN updates u ON u.organization_id = ac.organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;