-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Managers can view manager data" ON public.managers;
DROP POLICY IF EXISTS "Managers can update own profile" ON public.managers;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.managers;
DROP POLICY IF EXISTS "Enable select for all" ON public.managers;
DROP POLICY IF EXISTS "Enable update for self" ON public.managers;
DROP POLICY IF EXISTS "Authenticated users can insert managers" ON public.managers;

-- Create comprehensive policies for managers table
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