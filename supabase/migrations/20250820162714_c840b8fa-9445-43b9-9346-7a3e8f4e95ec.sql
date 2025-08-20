-- CRITICAL SECURITY FIX: Fix super_admins table RLS policies
-- Current policy "Users can check super admin status" allows ANY authenticated user
-- to view ALL super admin records, exposing:
-- - Super admin email addresses (enabling targeted attacks)
-- - Organization IDs and business relationships
-- - Complete super admin organizational structure
-- - Which users have the highest level of system access

ALTER TABLE public.super_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Drop the dangerous permissive policy that exposes super admin data
DROP POLICY IF EXISTS "Users can check super admin status" ON public.super_admins;

-- Keep existing secure policies that are properly scoped
-- Policy 1: Service role maintains full access (for system operations)
-- (This policy already exists and is secure)

-- Policy 2: Super admins can view their own record 
-- (This policy already exists and is secure)

-- Policy 3: Super admins can update their own record
-- (This policy already exists and is secure)

-- Add new secure policy: Super admins can view other super admins in same organization
CREATE POLICY "Super admins can view organization super admins" ON public.super_admins
FOR SELECT
USING (
  organization_id = public.get_user_organization_id(auth.email())
  AND public.is_super_admin(auth.email())
);

-- Note: The security definer functions is_super_admin(), get_user_organization_id(), 
-- and is_super_admin_of_org() will continue to work because they bypass RLS policies
-- and execute with elevated privileges. This maintains all existing functionality
-- while securing the data from direct table access.