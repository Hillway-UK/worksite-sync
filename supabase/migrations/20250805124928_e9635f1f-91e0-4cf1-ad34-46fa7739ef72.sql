-- Fix security definer functions by setting search_path

-- Function to get current clocked-in workers (fixed)
CREATE OR REPLACE FUNCTION get_clocked_in_workers()
RETURNS TABLE (
  worker_id uuid,
  worker_name text,
  job_name text,
  clock_in timestamp with time zone
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.worker_id,
    w.name as worker_name,
    j.name as job_name,
    ce.clock_in
  FROM public.clock_entries ce
  JOIN public.workers w ON ce.worker_id = w.id
  JOIN public.jobs j ON ce.job_id = j.id
  WHERE ce.clock_out IS NULL
  ORDER BY ce.clock_in DESC;
END;
$$;

-- Function to get total hours today (fixed)
CREATE OR REPLACE FUNCTION get_total_hours_today()
RETURNS numeric 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  RETURN COALESCE((
    SELECT SUM(total_hours)
    FROM public.clock_entries
    WHERE DATE(clock_in) = CURRENT_DATE
    AND total_hours IS NOT NULL
  ), 0);
END;
$$;

-- Function to get worker weekly hours (fixed)
CREATE OR REPLACE FUNCTION get_worker_weekly_hours(worker_uuid uuid, week_start date)
RETURNS numeric 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  RETURN COALESCE((
    SELECT SUM(total_hours)
    FROM public.clock_entries
    WHERE worker_id = worker_uuid
    AND DATE(clock_in) >= week_start
    AND DATE(clock_in) < week_start + INTERVAL '7 days'
    AND total_hours IS NOT NULL
  ), 0);
END;
$$;

-- Function to get recent activity (fixed)
CREATE OR REPLACE FUNCTION get_recent_activity()
RETURNS TABLE (
  id uuid,
  worker_name text,
  job_name text,
  clock_in timestamp with time zone,
  clock_out timestamp with time zone,
  total_hours numeric
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.id,
    w.name as worker_name,
    j.name as job_name,
    ce.clock_in,
    ce.clock_out,
    ce.total_hours
  FROM public.clock_entries ce
  JOIN public.workers w ON ce.worker_id = w.id
  JOIN public.jobs j ON ce.job_id = j.id
  ORDER BY ce.created_at DESC
  LIMIT 10;
END;
$$;