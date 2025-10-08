-- Fix get_clocked_in_workers to filter by manager's organization
CREATE OR REPLACE FUNCTION public.get_clocked_in_workers()
RETURNS TABLE(worker_id uuid, worker_name text, job_name text, clock_in timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the organization_id of the calling manager
  SELECT organization_id INTO v_org_id
  FROM managers
  WHERE email = auth.email()
  LIMIT 1;

  -- If not a manager, check if super_admin
  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM super_admins
    WHERE email = auth.email()
    LIMIT 1;
  END IF;

  -- Return clocked in workers only from the manager's organization
  RETURN QUERY
  SELECT 
    ce.worker_id,
    w.name as worker_name,
    j.name as job_name,
    ce.clock_in
  FROM clock_entries ce
  JOIN workers w ON ce.worker_id = w.id
  JOIN jobs j ON ce.job_id = j.id
  WHERE ce.clock_out IS NULL
    AND w.organization_id = v_org_id
  ORDER BY ce.clock_in DESC;
END;
$function$;

-- Fix get_total_hours_today to filter by manager's organization
CREATE OR REPLACE FUNCTION public.get_total_hours_today()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_total numeric;
BEGIN
  -- Get the organization_id of the calling manager
  SELECT organization_id INTO v_org_id
  FROM managers
  WHERE email = auth.email()
  LIMIT 1;

  -- If not a manager, check if super_admin
  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM super_admins
    WHERE email = auth.email()
    LIMIT 1;
  END IF;

  -- Calculate total hours only for workers in the manager's organization
  SELECT COALESCE(SUM(ce.total_hours), 0) INTO v_total
  FROM clock_entries ce
  JOIN workers w ON ce.worker_id = w.id
  WHERE DATE(ce.clock_in) = CURRENT_DATE
    AND ce.total_hours IS NOT NULL
    AND w.organization_id = v_org_id;

  RETURN v_total;
END;
$function$;

-- Fix get_recent_activity to filter by manager's organization
CREATE OR REPLACE FUNCTION public.get_recent_activity()
RETURNS TABLE(id uuid, worker_name text, job_name text, clock_in timestamp with time zone, clock_out timestamp with time zone, total_hours numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the organization_id of the calling manager
  SELECT organization_id INTO v_org_id
  FROM managers
  WHERE email = auth.email()
  LIMIT 1;

  -- If not a manager, check if super_admin
  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM super_admins
    WHERE email = auth.email()
    LIMIT 1;
  END IF;

  -- Return recent activity only for workers in the manager's organization
  RETURN QUERY
  SELECT 
    ce.id,
    w.name as worker_name,
    j.name as job_name,
    ce.clock_in,
    ce.clock_out,
    ce.total_hours
  FROM clock_entries ce
  JOIN workers w ON ce.worker_id = w.id
  JOIN jobs j ON ce.job_id = j.id
  WHERE w.organization_id = v_org_id
  ORDER BY ce.created_at DESC
  LIMIT 10;
END;
$function$;