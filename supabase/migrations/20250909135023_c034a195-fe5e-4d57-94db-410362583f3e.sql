-- PHASE 1: Simplify RLS policies for super admin access
-- Drop all existing organization policies to start fresh
DROP POLICY IF EXISTS "Super admins full access to organizations" ON public.organizations;
DROP POLICY IF EXISTS "Managers can access own organization" ON public.organizations;
DROP POLICY IF EXISTS "Super admins full access" ON public.organizations;

-- Create a single, simple policy for super admins with full access
CREATE POLICY "Super admins have complete access" 
ON public.organizations 
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email())
);

-- Create a simple policy for managers to access their own organization
CREATE POLICY "Managers can view own organization" 
ON public.organizations 
FOR SELECT
USING (
  id IN (SELECT organization_id FROM managers WHERE email = auth.email())
);

CREATE POLICY "Managers can update own organization" 
ON public.organizations 
FOR UPDATE
USING (
  id IN (SELECT organization_id FROM managers WHERE email = auth.email())
)
WITH CHECK (
  id IN (SELECT organization_id FROM managers WHERE email = auth.email())
);