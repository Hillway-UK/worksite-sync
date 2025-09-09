-- First, let's see what policies exist and then fix them appropriately
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Authenticated users can insert organizations" ON public.organizations;
    DROP POLICY IF EXISTS "Managers can update own organization" ON public.organizations;
    DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;
    DROP POLICY IF EXISTS "Super admins can create organizations" ON public.organizations;
    DROP POLICY IF EXISTS "Super admins can view all organizations" ON public.organizations;
    DROP POLICY IF EXISTS "Super admins can update organizations" ON public.organizations;
    DROP POLICY IF EXISTS "Super admins can delete organizations" ON public.organizations;
    
    -- Create new comprehensive policies for super admins
END $$;

-- Allow super admins full access to organizations
CREATE POLICY "Super admins full access to organizations" 
ON public.organizations 
FOR ALL
USING (
  EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email())
);

-- Allow managers to view and update their own organization
CREATE POLICY "Managers can access own organization" 
ON public.organizations 
FOR ALL
USING (
  id IN (SELECT organization_id FROM managers WHERE email = auth.email())
)
WITH CHECK (
  id IN (SELECT organization_id FROM managers WHERE email = auth.email())
);