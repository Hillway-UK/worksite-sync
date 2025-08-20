-- CRITICAL SECURITY FIX: Fix workers table RLS policies
-- Current policies allow ANYONE to read/write ALL worker data including:
-- - Employee names, email addresses, phone numbers
-- - Home addresses and personal contact information
-- - Hourly rates and financial compensation data
-- - Employment status and organizational membership
-- - Profile photos and other sensitive personal data

ALTER TABLE public.workers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

-- Drop the extremely dangerous permissive policies
DROP POLICY IF EXISTS "Allow insert workers" ON public.workers;
DROP POLICY IF EXISTS "Allow select workers" ON public.workers;
DROP POLICY IF EXISTS "Allow update workers" ON public.workers;
DROP POLICY IF EXISTS "Allow delete workers" ON public.workers;

-- Create secure policies based on role and organization membership

-- Policy 1: Workers can view and update their own record only
CREATE POLICY "Workers can manage own record" ON public.workers
FOR ALL
USING (email = auth.email())
WITH CHECK (email = auth.email());

-- Policy 2: Managers can view workers in their organization  
CREATE POLICY "Managers can view organization workers" ON public.workers
FOR SELECT
USING (
  organization_id = public.get_user_organization_id(auth.email())
  AND (
    public.is_manager(auth.email()) 
    OR public.is_super_admin(auth.email())
  )
);

-- Policy 3: Managers can insert workers into their organization
CREATE POLICY "Managers can insert organization workers" ON public.workers
FOR INSERT 
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.email())
  AND (
    public.is_manager(auth.email()) 
    OR public.is_super_admin(auth.email())
  )
);

-- Policy 4: Managers can update workers in their organization
CREATE POLICY "Managers can update organization workers" ON public.workers
FOR UPDATE
USING (
  organization_id = public.get_user_organization_id(auth.email())
  AND (
    public.is_manager(auth.email()) 
    OR public.is_super_admin(auth.email())
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.email())
  AND (
    public.is_manager(auth.email()) 
    OR public.is_super_admin(auth.email())
  )
);

-- Policy 5: Managers can delete workers in their organization
CREATE POLICY "Managers can delete organization workers" ON public.workers
FOR DELETE
USING (
  organization_id = public.get_user_organization_id(auth.email())
  AND (
    public.is_manager(auth.email()) 
    OR public.is_super_admin(auth.email())
  )
);