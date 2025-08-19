-- Add subscription user limits to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS max_workers INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS max_managers INTEGER DEFAULT 2;

-- Update existing organizations to have proper limits
UPDATE public.organizations 
SET max_workers = 10, max_managers = 2 
WHERE max_workers IS NULL OR max_managers IS NULL;