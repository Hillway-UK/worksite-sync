-- Allow managers to update workers table
CREATE POLICY "Managers can update workers" 
ON public.workers 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM managers 
  WHERE managers.email = auth.email()
));

-- Allow managers to insert into workers table  
CREATE POLICY "Managers can insert workers" 
ON public.workers 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM managers 
  WHERE managers.email = auth.email()
));

-- Allow managers to update their own profile
CREATE POLICY "Managers can update own profile" 
ON public.managers 
FOR UPDATE 
USING (email = auth.email());

-- Allow managers to update jobs table
CREATE POLICY "Managers can update jobs" 
ON public.jobs 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM managers 
  WHERE managers.email = auth.email()
));

-- Allow managers to insert into jobs table
CREATE POLICY "Managers can insert jobs" 
ON public.jobs 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM managers 
  WHERE managers.email = auth.email()
));

-- Function to get current clocked-in workers
CREATE OR REPLACE FUNCTION get_clocked_in_workers()
RETURNS TABLE (
  worker_id uuid,
  worker_name text,
  job_name text,
  clock_in timestamp with time zone
) AS $$
BEGIN
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
  ORDER BY ce.clock_in DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get total hours today
CREATE OR REPLACE FUNCTION get_total_hours_today()
RETURNS numeric AS $$
BEGIN
  RETURN COALESCE((
    SELECT SUM(total_hours)
    FROM clock_entries
    WHERE DATE(clock_in) = CURRENT_DATE
    AND total_hours IS NOT NULL
  ), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get worker weekly hours
CREATE OR REPLACE FUNCTION get_worker_weekly_hours(worker_uuid uuid, week_start date)
RETURNS numeric AS $$
BEGIN
  RETURN COALESCE((
    SELECT SUM(total_hours)
    FROM clock_entries
    WHERE worker_id = worker_uuid
    AND DATE(clock_in) >= week_start
    AND DATE(clock_in) < week_start + INTERVAL '7 days'
    AND total_hours IS NOT NULL
  ), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent activity
CREATE OR REPLACE FUNCTION get_recent_activity()
RETURNS TABLE (
  id uuid,
  worker_name text,
  job_name text,
  clock_in timestamp with time zone,
  clock_out timestamp with time zone,
  total_hours numeric
) AS $$
BEGIN
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
  ORDER BY ce.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;