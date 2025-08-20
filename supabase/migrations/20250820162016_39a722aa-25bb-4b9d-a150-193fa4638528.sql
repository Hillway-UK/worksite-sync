-- CRITICAL SECURITY FIX: Fix managers table RLS policies
-- Current policies allow ANYONE to read/write ALL manager data including:
-- - Manager email addresses (enabling targeted phishing attacks)
-- - Manager names and personal information
-- - Organization IDs (revealing business structure to competitors)
-- - Admin status and organizational roles
-- - PIN codes and other sensitive authentication data

ALTER TABLE public.managers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

-- Drop the extremely dangerous permissive policies
DROP POLICY IF EXISTS "Anyone can insert managers" ON public.managers;
DROP POLICY IF EXISTS "Anyone can read managers" ON public.managers;
DROP POLICY IF EXISTS "Anyone can update managers" ON public.managers;

-- Create secure policies based on role and organization membership

-- Policy 1: Managers can view their own record
CREATE POLICY "Managers can view own record" ON public.managers
FOR SELECT
USING (email = auth.email());

-- Policy 2: Managers can view other managers in same organization
CREATE POLICY "Managers can view organization managers" ON public.managers
FOR SELECT
USING (
  organization_id = public.get_user_organization_id(auth.email())
  AND (
    public.is_manager(auth.email()) 
    OR public.is_super_admin(auth.email())
  )
);

-- Policy 3: Only authenticated users can insert managers (for onboarding process)
-- This should be further restricted in application logic
CREATE POLICY "Authenticated users can insert managers" ON public.managers
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated'
  AND email = auth.email()
);

-- Policy 4: Managers can update their own record
CREATE POLICY "Managers can update own record" ON public.managers
FOR UPDATE
USING (email = auth.email())
WITH CHECK (email = auth.email());

-- Policy 5: Super admins can update managers in their organization
CREATE POLICY "Super admins can update organization managers" ON public.managers
FOR UPDATE
USING (
  organization_id = public.get_user_organization_id(auth.email())
  AND public.is_super_admin(auth.email())
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.email())
  AND public.is_super_admin(auth.email())
);

-- Note: No DELETE policy - manager deletion should go through application logic
-- with proper audit trails and organizational approval processes