-- Fix workers table RLS policies to prevent cross-organization data access
-- Drop the overly permissive super admin policy
DROP POLICY IF EXISTS "Super admins full access to workers" ON public.workers;

-- Create a more secure super admin policy that respects organization boundaries
CREATE POLICY "Super admins can manage organization workers" 
ON public.workers 
FOR ALL 
USING (
  organization_id IN (
    SELECT super_admins.organization_id 
    FROM super_admins 
    WHERE super_admins.email = auth.email()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT super_admins.organization_id 
    FROM super_admins 
    WHERE super_admins.email = auth.email()
  )
);