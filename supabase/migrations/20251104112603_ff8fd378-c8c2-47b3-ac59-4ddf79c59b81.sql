-- Add overtime tracking columns to clock_entries
ALTER TABLE clock_entries
  ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ot_status TEXT CHECK (ot_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS ot_requested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ot_approved_by UUID REFERENCES managers(id),
  ADD COLUMN IF NOT EXISTS ot_approved_reason TEXT,
  ADD COLUMN IF NOT EXISTS ot_approved_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient overtime queries
CREATE INDEX IF NOT EXISTS idx_clock_entries_overtime 
  ON clock_entries(is_overtime, ot_status, ot_requested_at) 
  WHERE is_overtime = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN clock_entries.is_overtime IS 'Indicates if this clock entry is an overtime request';
COMMENT ON COLUMN clock_entries.ot_status IS 'Status of overtime request: pending, approved, or rejected';

-- Create RPC function to get overtime requests for managers
CREATE OR REPLACE FUNCTION get_overtime_requests()
RETURNS TABLE (
  id UUID,
  worker_id UUID,
  worker_name TEXT,
  job_name TEXT,
  clock_in TIMESTAMP WITH TIME ZONE,
  clock_out TIMESTAMP WITH TIME ZONE,
  hours NUMERIC,
  ot_status TEXT,
  ot_requested_at TIMESTAMP WITH TIME ZONE,
  ot_approved_by UUID,
  ot_approved_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Return overtime requests from the last 14 days
  RETURN QUERY
  SELECT 
    ce.id,
    ce.worker_id,
    w.name AS worker_name,
    j.name AS job_name,
    ce.clock_in,
    ce.clock_out,
    CEIL(ce.total_hours * 10) / 10 AS hours,
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
$$;