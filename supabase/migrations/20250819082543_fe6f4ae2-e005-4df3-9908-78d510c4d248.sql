-- Fix function search path issues
DROP FUNCTION IF EXISTS public.is_super_admin(text);
DROP FUNCTION IF EXISTS public.get_user_organization_id(text);

-- Recreate functions with proper search path
CREATE OR REPLACE FUNCTION public.is_super_admin(user_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = user_email
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization_id(user_email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT organization_id FROM public.super_admins WHERE email = user_email),
    (SELECT organization_id FROM public.managers WHERE email = user_email),
    (SELECT organization_id FROM public.workers WHERE email = user_email)
  );
$$;