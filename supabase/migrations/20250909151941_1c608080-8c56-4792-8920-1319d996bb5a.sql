-- Drop all existing policies on managers table to start fresh
DROP POLICY IF EXISTS "Super admins can manage all managers" ON public.managers;
DROP POLICY IF EXISTS "Managers can view managers in same org" ON public.managers;
DROP POLICY IF EXISTS "Managers can update themselves" ON public.managers;
DROP POLICY IF EXISTS "Managers can view own record" ON public.managers;
DROP POLICY IF EXISTS "Managers can update own record" ON public.managers;
DROP POLICY IF EXISTS "Managers can view organization managers" ON public.managers;
DROP POLICY IF EXISTS "Super admins can update organization managers" ON public.managers;
DROP POLICY IF EXISTS "Authenticated users can insert managers" ON public.managers;

-- Create a single, comprehensive policy that eliminates recursive RLS issues
-- This gives super admins full access to all managers, and allows managers to access their own records
CREATE POLICY "Super admins full access to managers" 
ON public.managers 
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email()) 
  OR email = auth.email()
)
WITH CHECK (
  EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email()) 
  OR email = auth.email()
);