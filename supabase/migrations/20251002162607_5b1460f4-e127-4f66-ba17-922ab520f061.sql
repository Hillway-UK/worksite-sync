-- Create security definer functions for safe role and organization checks
-- These functions prevent RLS recursion and provide secure access validation

-- Function to check if a user is a manager in a specific organization
CREATE OR REPLACE FUNCTION public.user_is_manager_in_org(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.managers
    WHERE email = auth.email()
    AND organization_id = check_org_id
  );
$$;

-- Function to check if a user is a super admin in a specific organization
CREATE OR REPLACE FUNCTION public.user_is_super_admin_in_org(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins
    WHERE email = auth.email()
    AND organization_id = check_org_id
  );
$$;

-- Function to check if a user is a worker with a specific ID
CREATE OR REPLACE FUNCTION public.user_is_worker(check_worker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workers
    WHERE id = check_worker_id
    AND email = auth.email()
  );
$$;

-- Drop existing policies on workers table
DROP POLICY IF EXISTS "Managers can create organization workers" ON public.workers;
DROP POLICY IF EXISTS "Managers can update organization workers" ON public.workers;
DROP POLICY IF EXISTS "Managers can view organization workers" ON public.workers;
DROP POLICY IF EXISTS "Super admins can manage organization workers" ON public.workers;
DROP POLICY IF EXISTS "Workers can update own data" ON public.workers;
DROP POLICY IF EXISTS "Workers can view own data" ON public.workers;

-- Create new, more secure policies using the security definer functions

-- Policy for managers to view workers in their organization
CREATE POLICY "Managers can view organization workers"
ON public.workers
FOR SELECT
TO authenticated
USING (
  public.user_is_manager_in_org(organization_id)
  OR public.user_is_super_admin_in_org(organization_id)
);

-- Policy for managers to create workers in their organization
CREATE POLICY "Managers can create organization workers"
ON public.workers
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_is_manager_in_org(organization_id)
  OR public.user_is_super_admin_in_org(organization_id)
);

-- Policy for managers to update workers in their organization
CREATE POLICY "Managers can update organization workers"
ON public.workers
FOR UPDATE
TO authenticated
USING (
  public.user_is_manager_in_org(organization_id)
  OR public.user_is_super_admin_in_org(organization_id)
)
WITH CHECK (
  public.user_is_manager_in_org(organization_id)
  OR public.user_is_super_admin_in_org(organization_id)
);

-- Policy for workers to view their own data
CREATE POLICY "Workers can view own data"
ON public.workers
FOR SELECT
TO authenticated
USING (
  public.user_is_worker(id)
);

-- Policy for workers to update their own data (but not organization_id)
CREATE POLICY "Workers can update own data"
ON public.workers
FOR UPDATE
TO authenticated
USING (
  public.user_is_worker(id)
)
WITH CHECK (
  public.user_is_worker(id)
  AND organization_id = (SELECT organization_id FROM public.workers WHERE id = workers.id)
);

-- Add comment explaining the security improvements
COMMENT ON FUNCTION public.user_is_manager_in_org IS 'Security definer function to safely check if authenticated user is a manager in the specified organization. Prevents RLS recursion and ensures proper authentication validation.';
COMMENT ON FUNCTION public.user_is_super_admin_in_org IS 'Security definer function to safely check if authenticated user is a super admin in the specified organization. Prevents RLS recursion and ensures proper authentication validation.';
COMMENT ON FUNCTION public.user_is_worker IS 'Security definer function to safely check if authenticated user is the specified worker. Prevents RLS recursion and ensures proper authentication validation.';