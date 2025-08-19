-- Fix the infinite recursion in super_admins table policies

-- First, drop ALL existing policies on super_admins
DROP POLICY IF EXISTS "Super admins can manage same org admins" ON public.super_admins;
DROP POLICY IF EXISTS "Super admins can view own record" ON public.super_admins;
DROP POLICY IF EXISTS "Super admins can manage same org super_admins" ON public.super_admins;
DROP POLICY IF EXISTS "Anyone can view super admins" ON public.super_admins;
DROP POLICY IF EXISTS "Super admins full access" ON public.super_admins;

-- Temporarily disable RLS to clean up
ALTER TABLE public.super_admins DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Create NON-RECURSIVE policies using auth.email() directly

-- Policy 1: Super admins can view their own record
CREATE POLICY "Super admin can view own record" 
ON public.super_admins 
FOR SELECT 
USING (email = auth.email());

-- Policy 2: Super admins can update their own record
CREATE POLICY "Super admin can update own record" 
ON public.super_admins 
FOR UPDATE 
USING (email = auth.email())
WITH CHECK (email = auth.email());

-- Policy 3: Allow service role full access (for edge functions)
CREATE POLICY "Service role has full access" 
ON public.super_admins 
FOR ALL 
USING (auth.jwt()->>'role' = 'service_role');

-- Policy 4: Allow authenticated users to check if they are super admins (for auth checks)
CREATE POLICY "Users can check super admin status" 
ON public.super_admins 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- ALTERNATIVE APPROACH if you need organization-based access:
-- Create a simple function to check super admin status without recursion

CREATE OR REPLACE FUNCTION is_super_admin_of_org(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.super_admins 
    WHERE email = auth.email() 
    AND organization_id = org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Then use this function in policies for other tables if needed
-- For example, in organizations table:
DROP POLICY IF EXISTS "Super admins can manage their organization" ON public.organizations;

CREATE POLICY "Super admins can manage their organization" 
ON public.organizations 
FOR ALL 
USING (is_super_admin_of_org(id));

-- IMPORTANT: Also fix the organizations table policies to avoid recursion
DROP POLICY IF EXISTS "Super admins can manage their organization" ON public.organizations;
DROP POLICY IF EXISTS "Organization members can view their org" ON public.organizations;

-- Simpler organization policies
CREATE POLICY "Users can view their organization" 
ON public.organizations 
FOR SELECT 
USING (
  id IN (
    SELECT organization_id FROM public.managers WHERE email = auth.email()
    UNION
    SELECT organization_id FROM public.workers WHERE email = auth.email()
    UNION
    SELECT organization_id FROM public.super_admins WHERE email = auth.email()
  )
);

CREATE POLICY "Super admins can update their organization" 
ON public.organizations 
FOR UPDATE 
USING (
  id IN (
    SELECT organization_id FROM public.super_admins WHERE email = auth.email()
  )
);

CREATE POLICY "Service role can manage organizations" 
ON public.organizations 
FOR ALL 
USING (auth.jwt()->>'role' = 'service_role');