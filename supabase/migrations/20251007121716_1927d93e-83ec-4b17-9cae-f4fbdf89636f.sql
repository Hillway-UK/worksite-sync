-- Update handle_new_user to require organization_id from metadata (no Test Company fallback)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role TEXT;
  metadata_org_id TEXT;
BEGIN
  -- Get the role from user metadata
  user_role := NEW.raw_user_meta_data->>'role';
  
  -- Only create manager records for users with 'manager' role or no role specified
  -- Do NOT create manager records for workers
  IF user_role = 'worker' THEN
    RETURN NEW;
  END IF;
  
  -- Get organization_id from metadata (REQUIRED for managers)
  metadata_org_id := NEW.raw_user_meta_data->>'organization_id';
  
  -- If no organization_id provided, skip manager creation
  -- The calling code (SuperAdmin.tsx) will handle the insert manually
  IF metadata_org_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Create manager record with the specified organization
  INSERT INTO public.managers (email, name, organization_id)
  VALUES (
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    metadata_org_id::UUID
  )
  ON CONFLICT (email) DO UPDATE 
  SET organization_id = COALESCE(managers.organization_id, EXCLUDED.organization_id);
  
  RETURN NEW;
END;
$function$;