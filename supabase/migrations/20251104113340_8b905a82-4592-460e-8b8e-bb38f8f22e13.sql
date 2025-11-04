-- Drop and recreate the get_overtime_requests function with proper null handling and 3-hour cap
DROP FUNCTION IF EXISTS public.get_overtime_requests();

CREATE OR REPLACE FUNCTION public.get_overtime_requests()
RETURNS TABLE(
  id uuid,
  worker_id uuid,
  worker_name text,
  job_name text,
  clock_in timestamp with time zone,
  clock_out timestamp with time zone,
  hours numeric,
  ot_status text,
  ot_requested_at timestamp with time zone,
  ot_approved_by uuid,
  ot_approved_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
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

  -- Return overtime requests from the last 14 days with proper null handling and 3-hour cap
  RETURN QUERY
  SELECT 
    ce.id,
    ce.worker_id,
    w.name AS worker_name,
    j.name AS job_name,
    ce.clock_in,
    ce.clock_out,
    CASE 
      WHEN ce.clock_out IS NULL THEN NULL
      ELSE LEAST(
        CEIL(EXTRACT(EPOCH FROM (ce.clock_out - ce.clock_in)) / 3600 * 10) / 10,
        3.0
      )
    END AS hours,
    ce.ot_status,
    ce.ot_requested_at,
    ce.ot_approved_by,
    ce.ot_approved_reason
  FROM clock_entries ce
  JOIN workers w ON ce.worker_id = w.id
  JOIN jobs j ON ce.job_id = j.id
  WHERE ce.is_overtime = TRUE
    AND ce.clock_in >= NOW() - INTERVAL '14 days'
    AND w.organization_id = v_org_id
  ORDER BY 
    CASE 
      WHEN ce.ot_status = 'pending' THEN 0 
      ELSE 1 
    END, 
    ce.ot_requested_at ASC;
END;
$function$;