-- Create clock entry history table for audit trail
CREATE TABLE IF NOT EXISTS public.clock_entry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clock_entry_id UUID NOT NULL REFERENCES public.clock_entries(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  change_type TEXT NOT NULL,
  old_clock_in TIMESTAMP WITH TIME ZONE,
  old_clock_out TIMESTAMP WITH TIME ZONE,
  new_clock_in TIMESTAMP WITH TIME ZONE,
  new_clock_out TIMESTAMP WITH TIME ZONE,
  old_total_hours NUMERIC,
  new_total_hours NUMERIC,
  amendment_id UUID REFERENCES public.time_amendments(id),
  notes TEXT,
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.clock_entry_history ENABLE ROW LEVEL SECURITY;

-- Managers can view history for their org's workers
CREATE POLICY "Managers can view org clock entry history"
ON public.clock_entry_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clock_entries ce
    JOIN workers w ON ce.worker_id = w.id
    JOIN managers m ON w.organization_id = m.organization_id
    WHERE ce.id = clock_entry_history.clock_entry_id
    AND m.email = auth.email()
  )
);

-- Super admins can view all history
CREATE POLICY "Super admins can view all clock entry history"
ON public.clock_entry_history FOR SELECT
USING (is_super_admin(auth.email()));

-- Service role can insert history
CREATE POLICY "Service role can insert history"
ON public.clock_entry_history FOR INSERT
WITH CHECK (true);

-- Workers can view history for their own clock entries
CREATE POLICY "Workers can view own clock entry history"
ON public.clock_entry_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clock_entries ce
    WHERE ce.id = clock_entry_history.clock_entry_id
    AND ce.worker_id IN (
      SELECT id FROM workers WHERE email = auth.email()
    )
  )
);

-- Create function to update clock entry when amendment is approved
CREATE OR REPLACE FUNCTION public.update_clock_entry_on_amendment_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_old_clock_in TIMESTAMP WITH TIME ZONE;
  v_old_clock_out TIMESTAMP WITH TIME ZONE;
  v_old_total_hours NUMERIC;
  v_new_clock_in TIMESTAMP WITH TIME ZONE;
  v_new_clock_out TIMESTAMP WITH TIME ZONE;
  v_new_total_hours NUMERIC;
  v_manager_id UUID;
BEGIN
  -- Only proceed if status changed to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Get current clock entry values
    SELECT clock_in, clock_out, total_hours
    INTO v_old_clock_in, v_old_clock_out, v_old_total_hours
    FROM public.clock_entries
    WHERE id = NEW.clock_entry_id;
    
    -- Determine new values (use amended values if provided, otherwise keep original)
    v_new_clock_in := COALESCE(NEW.requested_clock_in, v_old_clock_in);
    v_new_clock_out := COALESCE(NEW.requested_clock_out, v_old_clock_out);
    
    -- Calculate new total_hours (in hours)
    IF v_new_clock_out IS NOT NULL AND v_new_clock_in IS NOT NULL THEN
      v_new_total_hours := EXTRACT(EPOCH FROM (v_new_clock_out - v_new_clock_in)) / 3600.0;
    ELSE
      v_new_total_hours := NULL;
    END IF;
    
    -- Update clock entry
    UPDATE public.clock_entries
    SET 
      clock_in = v_new_clock_in,
      clock_out = v_new_clock_out,
      total_hours = v_new_total_hours,
      notes = COALESCE(notes || ' | ', '') || 
              'Updated via approved time amendment on ' || 
              TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
    WHERE id = NEW.clock_entry_id;
    
    -- Get manager ID
    SELECT id INTO v_manager_id
    FROM public.managers
    WHERE email = auth.email()
    LIMIT 1;
    
    -- Create history record
    INSERT INTO public.clock_entry_history (
      clock_entry_id,
      changed_by,
      change_type,
      old_clock_in,
      old_clock_out,
      new_clock_in,
      new_clock_out,
      old_total_hours,
      new_total_hours,
      amendment_id,
      notes,
      metadata
    ) VALUES (
      NEW.clock_entry_id,
      COALESCE(v_manager_id, NEW.manager_id),
      'amendment_approval',
      v_old_clock_in,
      v_old_clock_out,
      v_new_clock_in,
      v_new_clock_out,
      v_old_total_hours,
      v_new_total_hours,
      NEW.id,
      NEW.manager_notes,
      jsonb_build_object(
        'approved_by', NEW.approved_by,
        'approved_at', NEW.approved_at,
        'reason', NEW.reason
      )
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_clock_entry_on_amendment_approval ON public.time_amendments;
CREATE TRIGGER trigger_update_clock_entry_on_amendment_approval
  AFTER UPDATE ON public.time_amendments
  FOR EACH ROW
  EXECUTE FUNCTION update_clock_entry_on_amendment_approval();