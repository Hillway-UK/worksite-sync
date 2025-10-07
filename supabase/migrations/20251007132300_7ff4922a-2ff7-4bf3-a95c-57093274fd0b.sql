-- Add DELETE policy for demo_requests table to allow GDPR-compliant data removal
-- This allows super admins and managers to delete demo requests when requested by data subjects

CREATE POLICY "Managers and super admins can delete demo requests"
ON public.demo_requests
FOR DELETE
TO authenticated
USING (
  -- Allow if user is a manager
  EXISTS (
    SELECT 1 
    FROM public.managers 
    WHERE email = auth.email()
  )
  OR
  -- Allow if user is a super admin
  EXISTS (
    SELECT 1 
    FROM public.super_admins 
    WHERE email = auth.email()
  )
);