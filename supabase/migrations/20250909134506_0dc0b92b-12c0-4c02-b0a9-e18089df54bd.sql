-- Fix RLS policies for organizations table
DROP POLICY IF EXISTS "Anyone can insert orgs" ON public.organizations;
DROP POLICY IF EXISTS "Anyone can read orgs" ON public.organizations;
DROP POLICY IF EXISTS "Anyone can update orgs" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can insert organizations" ON public.organizations;
DROP POLICY IF EXISTS "Managers can update own organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;

-- Create proper policies for super admins
CREATE POLICY "Super admins can create organizations" 
ON public.organizations 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email())
);

CREATE POLICY "Super admins can view all organizations" 
ON public.organizations 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email())
  OR 
  id IN (SELECT organization_id FROM managers WHERE email = auth.email())
);

CREATE POLICY "Super admins can update organizations" 
ON public.organizations 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email())
  OR
  id IN (SELECT organization_id FROM managers WHERE email = auth.email())
);

CREATE POLICY "Super admins can delete organizations" 
ON public.organizations 
FOR DELETE 
USING (
  EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email())
);