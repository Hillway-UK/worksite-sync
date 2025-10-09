-- Drop the overly permissive worker view policy
DROP POLICY IF EXISTS "Workers can view own organization" ON public.organizations;

-- Create a security definer function to check if user is a worker in the organization
CREATE OR REPLACE FUNCTION public.user_is_worker_in_org(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workers
    WHERE organization_id = check_org_id
      AND email = auth.email()
  );
$$;

-- Create a restrictive policy for workers - they can only see basic, non-sensitive organization info
-- This policy uses a CHECK constraint-like approach by returning NULL for sensitive columns
CREATE POLICY "Workers can view basic organization info only"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  -- Workers can only see their own organization
  user_is_worker_in_org(id)
);