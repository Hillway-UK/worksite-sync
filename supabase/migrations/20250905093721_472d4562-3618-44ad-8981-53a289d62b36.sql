-- COMPREHENSIVE FIX FOR LOGIN & ORGANIZATION SYSTEM

-- PART 1: Clean up duplicate organization
UPDATE managers 
SET organization_id = '3d66634f-926b-4ad2-b4b0-e9130bc13b59'
WHERE organization_id = '93d12e02-dd18-4814-a47b-f13031c3ecf2';

DELETE FROM organizations 
WHERE id = '93d12e02-dd18-4814-a47b-f13031c3ecf2';

-- PART 2: Create test organization and manager
INSERT INTO organizations (id, name, email, phone, subscription_status)
VALUES (
  gen_random_uuid(),
  'Test Company',
  'test@company.com',
  '01234567890',
  'active'
) ON CONFLICT DO NOTHING;

-- Create test manager (after you create auth user)
INSERT INTO managers (email, name, organization_id)
VALUES (
  'manager@test.com',
  'Test Manager',
  (SELECT id FROM organizations WHERE name = 'Test Company')
) ON CONFLICT (email) DO UPDATE 
SET organization_id = (SELECT id FROM organizations WHERE name = 'Test Company');

-- PART 3: Make organization_id nullable to prevent login blocks
ALTER TABLE public.managers 
ALTER COLUMN organization_id DROP NOT NULL;

-- PART 4: Create automatic trigger for new users
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Install trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- PART 5: Fix any existing users without manager records
INSERT INTO managers (email, name, organization_id)
SELECT 
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', u.email),
  (SELECT id FROM organizations WHERE name = 'Test Company')
FROM auth.users u
LEFT JOIN managers m ON u.email = m.email
WHERE m.email IS NULL;

-- PART 6: Ensure all managers have an organization
UPDATE managers 
SET organization_id = (SELECT id FROM organizations WHERE name = 'Test Company')
WHERE organization_id IS NULL;