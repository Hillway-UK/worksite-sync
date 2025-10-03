-- Add planned subscription columns to subscription_usage table
ALTER TABLE public.subscription_usage 
ADD COLUMN IF NOT EXISTS planned_number_of_managers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS planned_number_of_workers INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.subscription_usage.planned_number_of_managers IS 'Planned number of managers for subscription cost calculation';
COMMENT ON COLUMN public.subscription_usage.planned_number_of_workers IS 'Planned number of workers for subscription cost calculation';