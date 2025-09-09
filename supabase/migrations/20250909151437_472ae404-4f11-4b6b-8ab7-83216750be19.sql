-- Drop all existing policies on managers table
DROP POLICY IF EXISTS "Super admins can manage all managers" ON public.managers;
DROP POLICY IF EXISTS "Managers can view managers in same org" ON public.managers;
DROP POLICY IF EXISTS "Managers can update themselves" ON public.managers;
DROP POLICY IF EXISTS "Managers can view own record" ON public.managers;
DROP POLICY IF EXISTS "Managers can update own record" ON public.managers;
DROP POLICY IF EXISTS "Managers can view organization managers" ON public.managers;
DROP POLICY IF EXISTS "Super admins can update organization managers" ON public.managers;
DROP POLICY IF EXISTS "Authenticated users can insert managers" ON public.managers;

-- Create new comprehensive policies
CREATE POLICY "Super admins can manage all managers" 
ON public.managers 
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email())
);

CREATE POLICY "Managers can view managers in same org" 
ON public.managers 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id FROM managers WHERE email = auth.email()
  )
);

CREATE POLICY "Managers can update themselves" 
ON public.managers 
FOR UPDATE 
USING (email = auth.email())
WITH CHECK (email = auth.email());