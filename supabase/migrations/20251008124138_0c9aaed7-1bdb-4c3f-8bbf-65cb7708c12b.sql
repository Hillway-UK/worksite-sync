-- Fix demo_requests table security issue
-- Only super admins should be able to view, update, and delete demo requests
-- Regular managers should NOT have access to demo requests from other organizations

-- Drop existing manager access policies
DROP POLICY IF EXISTS "Only managers and super admins can view demo requests" ON public.demo_requests;
DROP POLICY IF EXISTS "Only managers and super admins can update demo requests" ON public.demo_requests;
DROP POLICY IF EXISTS "Managers and super admins can delete demo requests" ON public.demo_requests;

-- Create new policies: only super admins can manage demo requests
CREATE POLICY "Only super admins can view demo requests"
ON public.demo_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.super_admins
    WHERE super_admins.email = auth.email()
  )
);

CREATE POLICY "Only super admins can update demo requests"
ON public.demo_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.super_admins
    WHERE super_admins.email = auth.email()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.super_admins
    WHERE super_admins.email = auth.email()
  )
);

CREATE POLICY "Only super admins can delete demo requests"
ON public.demo_requests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.super_admins
    WHERE super_admins.email = auth.email()
  )
);

-- Keep the public insert policy (for demo request form submissions)
-- This is already correct and should remain unchanged