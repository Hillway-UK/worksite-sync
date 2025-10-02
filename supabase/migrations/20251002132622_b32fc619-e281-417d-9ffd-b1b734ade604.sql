-- Add column to track first-login modal dismissal for workers
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS first_login_info_dismissed BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.workers.first_login_info_dismissed IS 
'Tracks whether worker has dismissed the one-time first-login reminder modal about changing their temporary password';