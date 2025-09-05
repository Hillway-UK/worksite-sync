-- First check if super_admins table exists and drop/recreate policies
DROP POLICY IF EXISTS "Super admin can view own record" ON public.super_admins;
DROP POLICY IF EXISTS "Super admin can update own record" ON public.super_admins;
DROP POLICY IF EXISTS "Super admins can view organization super admins" ON public.super_admins;
DROP POLICY IF EXISTS "Service role has full access" ON public.super_admins;

-- Add organization_id column if it doesn't exist
ALTER TABLE public.super_admins 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Add is_owner column if it doesn't exist  
ALTER TABLE public.super_admins 
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT false;

-- Insert yourself as super admin
INSERT INTO public.super_admins (email, name) 
VALUES ('matt@hillwayco.uk', 'Matt') 
ON CONFLICT (email) DO NOTHING;

-- Create RLS policies for super_admins
CREATE POLICY "Super admin can view own record" 
ON public.super_admins 
FOR SELECT 
USING (email = auth.email());

CREATE POLICY "Super admin can update own record" 
ON public.super_admins 
FOR UPDATE 
USING (email = auth.email())
WITH CHECK (email = auth.email());

CREATE POLICY "Super admins can view organization super admins" 
ON public.super_admins 
FOR SELECT 
USING (organization_id = get_user_organization_id(auth.email()) AND is_super_admin(auth.email()));

CREATE POLICY "Service role has full access" 
ON public.super_admins 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');