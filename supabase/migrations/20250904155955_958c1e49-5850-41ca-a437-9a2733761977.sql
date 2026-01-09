-- Fix organization linking issues (simplified)
-- Step 1: Fix the unlinked manager first
UPDATE public.managers 
SET organization_id = (
  SELECT id FROM public.organizations 
  WHERE name ILIKE '%hillway%' 
  LIMIT 1
)
WHERE email = 'manager@hillwayco.uk' AND organization_id IS NULL;

-- Step 2: Identify and consolidate duplicate Hillway organizations
-- Get the organization with most workers (or first one if tied)
WITH hillway_orgs AS (
  SELECT o.id, COUNT(w.id) as worker_count
  FROM public.organizations o
  LEFT JOIN public.workers w ON w.organization_id = o.id
  WHERE o.name ILIKE '%hillway%'
  GROUP BY o.id
),
org_to_keep AS (
  SELECT id FROM hillway_orgs
  ORDER BY worker_count DESC, id ASC
  LIMIT 1
)
-- Update all managers to point to the organization we're keeping
UPDATE public.managers 
SET organization_id = (SELECT id FROM org_to_keep)
WHERE organization_id IN (
  SELECT o.id FROM public.organizations o
  WHERE o.name ILIKE '%hillway%'
  AND o.id NOT IN (SELECT id FROM org_to_keep)
);

-- Step 3: Update all workers to point to the organization we're keeping
WITH hillway_orgs AS (
  SELECT o.id, COUNT(w.id) as worker_count
  FROM public.organizations o
  LEFT JOIN public.workers w ON w.organization_id = o.id
  WHERE o.name ILIKE '%hillway%'
  GROUP BY o.id
),
org_to_keep AS (
  SELECT id FROM hillway_orgs
  ORDER BY worker_count DESC, id ASC
  LIMIT 1
)
UPDATE public.workers 
SET organization_id = (SELECT id FROM org_to_keep)
WHERE organization_id IN (
  SELECT o.id FROM public.organizations o
  WHERE o.name ILIKE '%hillway%'
  AND o.id NOT IN (SELECT id FROM org_to_keep)
);

-- Step 4: Delete duplicate organizations
WITH hillway_orgs AS (
  SELECT o.id, COUNT(w.id) as worker_count
  FROM public.organizations o
  LEFT JOIN public.workers w ON w.organization_id = o.id
  WHERE o.name ILIKE '%hillway%'
  GROUP BY o.id
),
org_to_keep AS (
  SELECT id FROM hillway_orgs
  ORDER BY worker_count DESC, id ASC
  LIMIT 1
)
DELETE FROM public.organizations 
WHERE name ILIKE '%hillway%' 
AND id NOT IN (SELECT id FROM org_to_keep);

-- Step 5: Ensure all workers have organization_id
UPDATE public.workers 
SET organization_id = (
  SELECT id FROM public.organizations LIMIT 1
)
WHERE organization_id IS NULL;

-- Step 6: Make organization_id required
ALTER TABLE public.managers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.workers ALTER COLUMN organization_id SET NOT NULL;

-- Step 7: Add foreign key constraints
ALTER TABLE public.managers 
ADD CONSTRAINT fk_managers_organization 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.workers 
ADD CONSTRAINT fk_workers_organization 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
