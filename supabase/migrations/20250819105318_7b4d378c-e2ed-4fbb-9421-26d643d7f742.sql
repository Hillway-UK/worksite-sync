-- Fix infinite recursion in super_admins RLS policies
DROP POLICY IF EXISTS "Super admins can manage same org admins" ON public.super_admins;
DROP POLICY IF EXISTS "Super admins can view own record" ON public.super_admins;

-- Create proper RLS policies for super_admins
CREATE POLICY "Super admins can view own record" 
ON public.super_admins 
FOR SELECT 
USING (email = auth.email());

CREATE POLICY "Super admins can manage same org super_admins" 
ON public.super_admins 
FOR ALL 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.super_admins sa 
    WHERE sa.email = auth.email()
  )
);