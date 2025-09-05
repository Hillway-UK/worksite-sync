-- Fix security warning for function search path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Get Test Company as default for new users
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
  
  -- Create manager record
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;