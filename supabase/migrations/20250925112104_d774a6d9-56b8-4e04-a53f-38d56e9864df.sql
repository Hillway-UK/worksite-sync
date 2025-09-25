-- Fix RLS policy for managers to create jobs
-- Drop existing policy and recreate with proper INSERT permissions
DROP POLICY IF EXISTS "Managers can manage organization jobs" ON public.jobs;

-- Create separate policies for better control
CREATE POLICY "Managers can create organization jobs" 
ON public.jobs 
FOR INSERT 
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT managers.organization_id
    FROM managers
    WHERE managers.email = auth.email()
  )
);

CREATE POLICY "Managers can update organization jobs" 
ON public.jobs 
FOR UPDATE 
TO authenticated
USING (
  organization_id IN (
    SELECT managers.organization_id
    FROM managers
    WHERE managers.email = auth.email()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT managers.organization_id
    FROM managers
    WHERE managers.email = auth.email()
  )
);

CREATE POLICY "Managers can delete organization jobs" 
ON public.jobs 
FOR DELETE 
TO authenticated
USING (
  organization_id IN (
    SELECT managers.organization_id
    FROM managers
    WHERE managers.email = auth.email()
  )
);

CREATE POLICY "Managers can view organization jobs" 
ON public.jobs 
FOR SELECT 
TO authenticated
USING (
  organization_id IN (
    SELECT managers.organization_id
    FROM managers
    WHERE managers.email = auth.email()
  )
);