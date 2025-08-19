-- Fix security warnings for function search path
CREATE OR REPLACE FUNCTION is_super_admin_of_org(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.super_admins 
    WHERE email = auth.email() 
    AND organization_id = org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;