-- Fix security vulnerability in managers table
-- Implement granular RLS policies following principle of least privilege

-- Drop existing broad policy to rebuild with stricter security
DROP POLICY IF EXISTS "Super admins full access to managers" ON public.managers;

-- 1. Super admins can manage all managers (for system administration)
CREATE POLICY "Super admins can manage all managers" 
ON public.managers 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
);

-- 2. Managers can only view their own record
CREATE POLICY "Managers can view own record" 
ON public.managers 
FOR SELECT 
TO authenticated
USING (email = auth.email());

-- 3. Managers can update only their own record (but not sensitive organizational fields)
CREATE POLICY "Managers can update own record" 
ON public.managers 
FOR UPDATE 
TO authenticated
USING (email = auth.email())
WITH CHECK (
  email = auth.email() AND
  -- Prevent managers from changing their organization_id or admin status
  organization_id = (SELECT organization_id FROM public.managers WHERE email = auth.email()) AND
  is_admin = (SELECT is_admin FROM public.managers WHERE email = auth.email()) AND
  is_super = (SELECT is_super FROM public.managers WHERE email = auth.email())
);

-- 4. Only super admins can create new managers
-- No separate INSERT policy for managers = they cannot create new manager records

-- 5. Only super admins can delete managers (preserve audit trail)
-- No DELETE policy for regular managers = they cannot delete manager records

-- This ensures:
-- - Managers can only see and update their own basic info (name, pin)
-- - Managers cannot change organizational settings or privileges
-- - Only super admins can create/delete manager accounts
-- - All other authenticated users are completely blocked from manager data