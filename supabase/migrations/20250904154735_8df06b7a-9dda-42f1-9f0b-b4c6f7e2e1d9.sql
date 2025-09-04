-- Fix RLS policies for workers table and make organization_id required

-- Make organization_id required (not nullable)
ALTER TABLE public.workers ALTER COLUMN organization_id SET NOT NULL;

-- Drop existing restrictive RLS policies that may be causing issues
DROP POLICY IF EXISTS "Managers can view organization workers" ON public.workers;
DROP POLICY IF EXISTS "Managers can insert organization workers" ON public.workers;
DROP POLICY IF EXISTS "Managers can update organization workers" ON public.workers;
DROP POLICY IF EXISTS "Managers can delete organization workers" ON public.workers;
DROP POLICY IF EXISTS "Workers can manage own record" ON public.workers;

-- Create new comprehensive policies for managers
CREATE POLICY "Managers can manage organization workers" ON public.workers
FOR ALL USING (
  organization_id IN (
    SELECT organization_id FROM public.managers 
    WHERE email = auth.email()
  )
) WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.managers 
    WHERE email = auth.email()
  )
);

-- Allow workers to view and update their own records
CREATE POLICY "Workers can view own record" ON public.workers
FOR SELECT USING (email = auth.email());

CREATE POLICY "Workers can update own record" ON public.workers
FOR UPDATE USING (email = auth.email()) WITH CHECK (email = auth.email());