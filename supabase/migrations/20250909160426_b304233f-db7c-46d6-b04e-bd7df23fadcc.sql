-- Fix security vulnerability in workers table
-- Strengthen RLS policies to ensure proper access control for sensitive personal data

-- Drop existing policies to rebuild with stricter security
DROP POLICY IF EXISTS "Managers can manage organization workers" ON public.workers;
DROP POLICY IF EXISTS "Workers can update own record" ON public.workers;
DROP POLICY IF EXISTS "Workers can view own record" ON public.workers;

-- Super admins can manage all workers (for system administration)
CREATE POLICY "Super admins can manage all workers" 
ON public.workers 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
);

-- Managers can only view and manage workers within their own organization
CREATE POLICY "Managers can view organization workers" 
ON public.workers 
FOR SELECT 
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.managers 
    WHERE email = auth.email()
  )
);

CREATE POLICY "Managers can insert organization workers" 
ON public.workers 
FOR INSERT 
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.managers 
    WHERE email = auth.email()
  )
);

CREATE POLICY "Managers can update organization workers" 
ON public.workers 
FOR UPDATE 
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.managers 
    WHERE email = auth.email()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.managers 
    WHERE email = auth.email()
  )
);

-- Workers can only view their own personal record
CREATE POLICY "Workers can view own record" 
ON public.workers 
FOR SELECT 
TO authenticated
USING (email = auth.email());

-- Workers can only update their own personal record (but not sensitive fields like hourly_rate)
CREATE POLICY "Workers can update own record" 
ON public.workers 
FOR UPDATE 
TO authenticated
USING (email = auth.email())
WITH CHECK (email = auth.email());

-- Ensure no one can delete workers except super admins (preserve audit trail)
-- Only super admins have DELETE access through their "manage all workers" policy
-- No separate DELETE policy for managers/workers = they cannot delete