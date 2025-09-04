-- Fix organization linking issues (corrected)
-- Step 1: Identify organizations to keep and remove
WITH hillway_orgs AS (
  SELECT o.id, o.name, COUNT(w.id) as worker_count
  FROM public.organizations o
  LEFT JOIN public.workers w ON w.organization_id = o.id
  WHERE o.name ILIKE '%hillway%'
  GROUP BY o.id, o.name
),
org_to_keep AS (
  SELECT id FROM hillway_orgs
  ORDER BY worker_count DESC, created_at ASC
  LIMIT 1
),
orgs_to_remove AS (
  SELECT h.id FROM hillway_orgs h
  WHERE h.id NOT IN (SELECT id FROM org_to_keep)
)
-- Step 2: Update all managers pointing to duplicate orgs to point to the one we keep
UPDATE public.managers 
SET organization_id = (SELECT id FROM org_to_keep)
WHERE organization_id IN (SELECT id FROM orgs_to_remove);

-- Step 3: Update all workers pointing to duplicate orgs to point to the one we keep  
WITH hillway_orgs AS (
  SELECT o.id, o.name, COUNT(w.id) as worker_count
  FROM public.organizations o
  LEFT JOIN public.workers w ON w.organization_id = o.id
  WHERE o.name ILIKE '%hillway%'
  GROUP BY o.id, o.name
),
org_to_keep AS (
  SELECT id FROM hillway_orgs
  ORDER BY worker_count DESC, created_at ASC
  LIMIT 1
),
orgs_to_remove AS (
  SELECT h.id FROM hillway_orgs h
  WHERE h.id NOT IN (SELECT id FROM org_to_keep)
)
UPDATE public.workers 
SET organization_id = (SELECT id FROM org_to_keep)
WHERE organization_id IN (SELECT id FROM orgs_to_remove);

-- Step 4: Fix the unlinked manager
UPDATE public.managers 
SET organization_id = (
  SELECT id FROM public.organizations 
  WHERE name ILIKE '%hillway%' 
  LIMIT 1
)
WHERE email = 'manager@pioneer.com' AND organization_id IS NULL;

-- Step 5: Now safely delete duplicate organizations
WITH hillway_orgs AS (
  SELECT o.id, o.name, COUNT(w.id) as worker_count
  FROM public.organizations o
  LEFT JOIN public.workers w ON w.organization_id = o.id
  WHERE o.name ILIKE '%hillway%'
  GROUP BY o.id, o.name
),
org_to_keep AS (
  SELECT id FROM hillway_orgs
  ORDER BY worker_count DESC, created_at ASC
  LIMIT 1
)
DELETE FROM public.organizations 
WHERE name ILIKE '%hillway%' 
AND id NOT IN (SELECT id FROM org_to_keep);

-- Step 6: Ensure all remaining workers have organization_id
UPDATE public.workers 
SET organization_id = (
  SELECT id FROM public.organizations LIMIT 1
)
WHERE organization_id IS NULL;

-- Step 7: Make organization_id required for managers and workers
ALTER TABLE public.managers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.workers ALTER COLUMN organization_id SET NOT NULL;

-- Step 8: Add foreign key constraints for data integrity
ALTER TABLE public.managers 
ADD CONSTRAINT fk_managers_organization 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.workers 
ADD CONSTRAINT fk_workers_organization 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Step 9: Create helper function for organization setup
CREATE OR REPLACE FUNCTION public.setup_new_organization(
  org_name TEXT,
  org_email TEXT, 
  org_phone TEXT DEFAULT NULL,
  org_address TEXT DEFAULT NULL,
  admin_email TEXT,
  admin_name TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create organization
  INSERT INTO public.organizations (name, email, phone, address, subscription_status)
  VALUES (org_name, org_email, org_phone, org_address, 'active')
  RETURNING id INTO new_org_id;
  
  -- Note: Manager will be created separately after auth user is created
  -- This function just returns the org_id for reference
  
  RETURN new_org_id;
END;
$$;