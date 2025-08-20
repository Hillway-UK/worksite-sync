-- CRITICAL SECURITY FIX: Fix organizations table RLS policies
-- Current policies allow ANYONE to read/write ALL organization data including:
-- - VAT numbers, company registration numbers
-- - Stripe customer IDs and subscription data  
-- - Email addresses, phone numbers, addresses
-- - Financial subscription information

ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop the dangerous permissive policies
DROP POLICY IF EXISTS "Anyone can insert orgs" ON public.organizations;
DROP POLICY IF EXISTS "Anyone can read orgs" ON public.organizations;  
DROP POLICY IF EXISTS "Anyone can update orgs" ON public.organizations;

-- Create secure policies based on organization membership and roles

-- Policy 1: Users can only view their own organization's data
CREATE POLICY "Users can view own organization" ON public.organizations
FOR SELECT 
USING (
  id = public.get_user_organization_id(auth.email())
);

-- Policy 2: Only managers and super_admins can update their organization
CREATE POLICY "Managers can update own organization" ON public.organizations  
FOR UPDATE
USING (
  id = public.get_user_organization_id(auth.email()) 
  AND (
    public.is_manager(auth.email()) 
    OR public.is_super_admin(auth.email())
  )
);

-- Policy 3: Only authenticated users can insert organizations (for onboarding)
-- This should be restricted further in application logic
CREATE POLICY "Authenticated users can insert organizations" ON public.organizations
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Policy 4: No delete access - organizations should not be deleted casually
-- DELETE operations should go through application logic with proper checks