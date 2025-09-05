-- Create super_admins table for system owners
CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  is_owner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on super_admins
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

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

-- Update is_super_admin function to work with new table structure
CREATE OR REPLACE FUNCTION public.is_super_admin(user_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = user_email
  );
$$;

-- Create function to check if user is super admin of specific org
CREATE OR REPLACE FUNCTION public.is_super_admin_of_org(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.super_admins 
    WHERE email = auth.email() 
    AND organization_id = org_id
  );
END;
$$;