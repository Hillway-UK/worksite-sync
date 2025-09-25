-- Create optimized function for user role lookup
CREATE OR REPLACE FUNCTION public.get_user_role_and_org(user_email text)
RETURNS TABLE(role text, organization_id uuid) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check super_admins first
  SELECT 'super_admin'::text, sa.organization_id 
  FROM public.super_admins sa
  WHERE sa.email = user_email
  INTO role, organization_id;
  
  IF FOUND THEN
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Check managers
  SELECT 'manager'::text, m.organization_id 
  FROM public.managers m
  WHERE m.email = user_email
  INTO role, organization_id;
  
  IF FOUND THEN
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Check workers
  SELECT 'worker'::text, w.organization_id 
  FROM public.workers w
  WHERE w.email = user_email
  INTO role, organization_id;
  
  IF FOUND THEN
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- No role found
  role := NULL;
  organization_id := NULL;
  RETURN NEXT;
END;
$$;