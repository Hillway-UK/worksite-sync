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

-- Drop existing policy if it exists to recreate with proper security
DROP POLICY IF EXISTS "Super admins can view organization super admins" ON public.super_admins;

-- Keep existing secure policies (they are already properly scoped):
-- - "Service role has full access" - needed for system operations
-- - "Super admin can view own record" - allows self-access only  
-- - "Super admin can update own record" - allows self-updates only

-- Add secure policy: Super admins can view other super admins in same organization
CREATE POLICY "Super admins can view organization super admins" ON public.super_admins
FOR SELECT
USING (
  organization_id = public.get_user_organization_id(auth.email())
  AND public.is_super_admin(auth.email())
);

-- IMPORTANT: The security definer functions is_super_admin(), get_user_organization_id(), 
-- and is_super_admin_of_org() will continue to work because they execute with 
-- elevated privileges and bypass RLS policies. This maintains all existing 
-- functionality while securing direct table access from regular users.