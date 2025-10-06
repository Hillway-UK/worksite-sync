-- Update increment_active_managers to only update existing rows
CREATE OR REPLACE FUNCTION public.increment_active_managers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month date;
BEGIN
  current_month := date_trunc('month', CURRENT_DATE);
  
  -- Only update existing row, don't insert new one
  UPDATE subscription_usage
  SET active_managers = active_managers + 1
  WHERE organization_id = NEW.organization_id
    AND month = current_month;
  
  -- If no row was updated, log a warning
  IF NOT FOUND THEN
    RAISE WARNING 'No subscription_usage row found for organization % in month %', 
                  NEW.organization_id, current_month;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update increment_active_workers to only update existing rows
CREATE OR REPLACE FUNCTION public.increment_active_workers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month date;
BEGIN
  current_month := date_trunc('month', CURRENT_DATE);
  
  -- Only update existing row, don't insert new one
  UPDATE subscription_usage
  SET active_workers = active_workers + 1
  WHERE organization_id = NEW.organization_id
    AND month = current_month;
  
  -- If no row was updated, log a warning
  IF NOT FOUND THEN
    RAISE WARNING 'No subscription_usage row found for organization % in month %', 
                  NEW.organization_id, current_month;
  END IF;
  
  RETURN NEW;
END;
$$;