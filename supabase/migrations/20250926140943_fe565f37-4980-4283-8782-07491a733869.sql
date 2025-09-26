-- Create security definer function to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS TABLE(is_super_admin boolean, is_manager boolean, organization_id uuid) AS $$
BEGIN
  -- Check super_admins first
  SELECT 
    true as is_super_admin,
    false as is_manager,
    sa.organization_id
  FROM public.super_admins sa
  WHERE sa.email = auth.email()
  INTO is_super_admin, is_manager, organization_id;
  
  IF FOUND THEN
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Check managers
  SELECT 
    false as is_super_admin,
    true as is_manager,
    m.organization_id
  FROM public.managers m
  WHERE m.email = auth.email()
  INTO is_super_admin, is_manager, organization_id;
  
  IF FOUND THEN
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- No permissions found
  is_super_admin := false;
  is_manager := false;
  organization_id := null;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Super admins can manage all managers" ON public.managers;

-- Create new policy using the security definer function
CREATE POLICY "Super admins can manage all managers" ON public.managers
FOR ALL USING (
  (SELECT perms.is_super_admin FROM public.get_current_user_permissions() perms LIMIT 1) = true
)
WITH CHECK (
  (SELECT perms.is_super_admin FROM public.get_current_user_permissions() perms LIMIT 1) = true
);