-- Add shift time columns to workers table
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS shift_start time without time zone DEFAULT '07:00:00',
ADD COLUMN IF NOT EXISTS shift_end time without time zone DEFAULT '15:00:00',
ADD COLUMN IF NOT EXISTS shift_days integer[] DEFAULT ARRAY[1,2,3,4,5];

COMMENT ON COLUMN public.workers.shift_start IS 'Individual worker shift start time';
COMMENT ON COLUMN public.workers.shift_end IS 'Individual worker shift end time';
COMMENT ON COLUMN public.workers.shift_days IS 'Days of week worker is scheduled (1=Monday, 7=Sunday)';