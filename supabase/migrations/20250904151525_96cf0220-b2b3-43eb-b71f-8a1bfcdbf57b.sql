-- Add is_super column to managers table for super user access control
ALTER TABLE public.managers 
ADD COLUMN IF NOT EXISTS is_super BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.managers.is_super IS 'Indicates if the manager has super user privileges for organisation settings';