-- Create function to check if user can manage an organization
-- Super admins can manage ANY organization
-- Managers can only manage THEIR OWN organization
CREATE OR REPLACE FUNCTION public.can_manage_organization(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email text;
BEGIN
  user_email := auth.email();
  
  -- Check if user is a super admin (can manage any org)
  IF EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = user_email
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if user is a manager of THIS specific organization
  IF EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = user_email 
    AND organization_id = target_org_id
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;