-- Add unique constraint for subscription_usage (one record per org per month)
ALTER TABLE subscription_usage 
ADD CONSTRAINT unique_org_month UNIQUE (organization_id, month);

-- Function to get current subscription capacity for an organization
CREATE OR REPLACE FUNCTION get_subscription_capacity(org_id uuid)
RETURNS TABLE (
  planned_managers integer,
  active_managers integer,
  planned_workers integer,
  active_workers integer,
  managers_available integer,
  workers_available integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month date;
BEGIN
  current_month := date_trunc('month', CURRENT_DATE);
  
  RETURN QUERY
  SELECT 
    su.planned_number_of_managers,
    su.active_managers,
    su.planned_number_of_workers,
    su.active_workers,
    GREATEST(su.planned_number_of_managers - su.active_managers, 0) as managers_available,
    GREATEST(su.planned_number_of_workers - su.active_workers, 0) as workers_available
  FROM subscription_usage su
  WHERE su.organization_id = org_id
    AND su.month >= current_month
  ORDER BY su.month DESC
  LIMIT 1;
END;
$$;

-- Trigger function to increment active_managers when a new manager is added
CREATE OR REPLACE FUNCTION increment_active_managers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month date;
BEGIN
  current_month := date_trunc('month', CURRENT_DATE);
  
  INSERT INTO subscription_usage (
    organization_id,
    month,
    active_managers,
    active_workers,
    planned_number_of_managers,
    planned_number_of_workers
  )
  VALUES (
    NEW.organization_id,
    current_month,
    1,
    0,
    0,
    0
  )
  ON CONFLICT (organization_id, month) 
  DO UPDATE SET active_managers = subscription_usage.active_managers + 1;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_manager_insert
AFTER INSERT ON managers
FOR EACH ROW
EXECUTE FUNCTION increment_active_managers();

-- Trigger function to increment active_workers when a new worker is added
CREATE OR REPLACE FUNCTION increment_active_workers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month date;
BEGIN
  current_month := date_trunc('month', CURRENT_DATE);
  
  INSERT INTO subscription_usage (
    organization_id,
    month,
    active_workers,
    active_managers,
    planned_number_of_managers,
    planned_number_of_workers
  )
  VALUES (
    NEW.organization_id,
    current_month,
    1,
    0,
    0,
    0
  )
  ON CONFLICT (organization_id, month)
  DO UPDATE SET active_workers = subscription_usage.active_workers + 1;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_worker_insert
AFTER INSERT ON workers
FOR EACH ROW
EXECUTE FUNCTION increment_active_workers();

-- Trigger function to decrement active_managers when managers are deleted
CREATE OR REPLACE FUNCTION decrement_active_managers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month date;
BEGIN
  current_month := date_trunc('month', CURRENT_DATE);
  
  UPDATE subscription_usage
  SET active_managers = GREATEST(active_managers - 1, 0)
  WHERE organization_id = OLD.organization_id
    AND month = current_month;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER after_manager_delete
AFTER DELETE ON managers
FOR EACH ROW
EXECUTE FUNCTION decrement_active_managers();

-- Trigger function to decrement active_workers when workers are deleted
CREATE OR REPLACE FUNCTION decrement_active_workers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month date;
BEGIN
  current_month := date_trunc('month', CURRENT_DATE);
  
  UPDATE subscription_usage
  SET active_workers = GREATEST(active_workers - 1, 0)
  WHERE organization_id = OLD.organization_id
    AND month = current_month;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER after_worker_delete
AFTER DELETE ON workers
FOR EACH ROW
EXECUTE FUNCTION decrement_active_workers();