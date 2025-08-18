-- Fix security warnings by setting proper search_path for functions
DROP FUNCTION IF EXISTS public.auto_clock_out_after_12_hours();

CREATE OR REPLACE FUNCTION public.auto_clock_out_after_12_hours()
RETURNS void AS $$
BEGIN
  UPDATE public.clock_entries
  SET 
    clock_out = clock_in + INTERVAL '12 hours',
    auto_clocked_out = true,
    notes = COALESCE(notes || ' | ', '') || 'Auto clocked-out after 12 hours'
  WHERE 
    clock_out IS NULL
    AND clock_in < NOW() - INTERVAL '12 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';