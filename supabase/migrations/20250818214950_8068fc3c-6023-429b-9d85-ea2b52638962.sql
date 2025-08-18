-- Add fields for manual entries and auto clock-out
ALTER TABLE public.clock_entries 
ADD COLUMN IF NOT EXISTS manual_entry BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_clocked_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create function for auto clock-out after 12 hours
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE,
  push_token TEXT,
  morning_reminder BOOLEAN DEFAULT TRUE,
  evening_reminder BOOLEAN DEFAULT TRUE,
  reminder_time_morning TIME DEFAULT '09:00:00',
  reminder_time_evening TIME DEFAULT '19:00:00',
  enabled_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- Mon-Fri
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notification_preferences
CREATE POLICY "Workers can manage own notification preferences" 
ON public.notification_preferences 
FOR ALL 
USING (worker_id IN (
  SELECT workers.id FROM public.workers 
  WHERE workers.email = auth.email()
));

CREATE POLICY "Managers can view all notification preferences" 
ON public.notification_preferences 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.managers 
  WHERE managers.email = auth.email()
));