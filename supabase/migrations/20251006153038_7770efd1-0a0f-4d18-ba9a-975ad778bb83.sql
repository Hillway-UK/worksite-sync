-- Backfill current month active counts from actual tables
DO $$
BEGIN
  -- Managers
  UPDATE subscription_usage su
  SET active_managers = COALESCE(m.cnt, 0)
  FROM (
    SELECT organization_id, COUNT(*) AS cnt
    FROM managers
    GROUP BY organization_id
  ) AS m
  WHERE su.organization_id = m.organization_id
    AND date_trunc('month', su.month) = date_trunc('month', CURRENT_DATE);

  -- Workers
  UPDATE subscription_usage su
  SET active_workers = COALESCE(w.cnt, 0)
  FROM (
    SELECT organization_id, COUNT(*) AS cnt
    FROM workers
    GROUP BY organization_id
  ) AS w
  WHERE su.organization_id = w.organization_id
    AND date_trunc('month', su.month) = date_trunc('month', CURRENT_DATE);
END $$;