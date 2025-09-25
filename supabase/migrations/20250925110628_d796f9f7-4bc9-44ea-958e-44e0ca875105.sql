-- Update the handle_new_user function to not create manager records for workers
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  default_org_id UUID;
  user_role TEXT;
BEGIN
  -- Get the role from user metadata
  user_role := NEW.raw_user_meta_data->>'role';
  
  -- Only create manager records for users with 'manager' role or no role specified
  -- Do NOT create manager records for workers
  IF user_role = 'worker' THEN
    RETURN NEW;
  END IF;
  
  -- Get Test Company as default for new managers
  SELECT id INTO default_org_id 
  FROM public.organizations 
  WHERE name = 'Test Company'
  LIMIT 1;
  
  -- If no test company, use first org
  IF default_org_id IS NULL THEN
    SELECT id INTO default_org_id 
    FROM public.organizations 
    LIMIT 1;
  END IF;
  
  -- Create manager record only for non-worker users
  INSERT INTO public.managers (email, name, organization_id)
  VALUES (
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    default_org_id
  )
  ON CONFLICT (email) DO UPDATE 
  SET organization_id = COALESCE(managers.organization_id, EXCLUDED.organization_id);
  
  RETURN NEW;
END;
$function$;