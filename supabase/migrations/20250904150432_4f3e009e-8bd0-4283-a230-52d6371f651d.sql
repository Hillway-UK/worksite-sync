-- Update demo_requests table to support the new demo request system
ALTER TABLE public.demo_requests 
ADD COLUMN IF NOT EXISTS admin_users INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS worker_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ensure RLS policies are correct
DROP POLICY IF EXISTS "Insert demo requests" ON public.demo_requests;
DROP POLICY IF EXISTS "Managers can view all demo requests" ON public.demo_requests;

-- Allow anyone to create demo requests (no auth required)
CREATE POLICY "Anyone can create demo requests" ON public.demo_requests
FOR INSERT WITH CHECK (true);

-- Only managers and super admins can view demo requests
CREATE POLICY "Managers can view all demo requests" ON public.demo_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = auth.email()
  ) OR EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
);