-- Fix security vulnerability in workers table
-- First drop ALL existing policies, then create secure ones

-- Drop all existing policies on workers table (including any partial ones)
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'workers'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      policy_record.policyname, 
                      policy_record.schemaname, 
                      policy_record.tablename);
    END LOOP;
END $$;

-- Create comprehensive secure policies for workers table

-- 1. Super admins can manage all workers (for system administration)
CREATE POLICY "Super admins full access to workers" 
ON public.workers 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
);

-- 2. Managers can only SELECT workers within their organization
CREATE POLICY "Managers can view organization workers" 
ON public.workers 
FOR SELECT 
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.managers 
    WHERE email = auth.email()
  )
);

-- 3. Managers can INSERT workers into their organization
CREATE POLICY "Managers can create organization workers" 
ON public.workers 
FOR INSERT 
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.managers 
    WHERE email = auth.email()
  )
);

-- 4. Managers can UPDATE workers within their organization
CREATE POLICY "Managers can update organization workers" 
ON public.workers 
FOR UPDATE 
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.managers 
    WHERE email = auth.email()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.managers 
    WHERE email = auth.email()
  )
);

-- 5. Workers can only SELECT their own record
CREATE POLICY "Workers can view own data" 
ON public.workers 
FOR SELECT 
TO authenticated
USING (email = auth.email());

-- 6. Workers can UPDATE only their own record 
CREATE POLICY "Workers can update own data" 
ON public.workers 
FOR UPDATE 
TO authenticated
USING (email = auth.email())
WITH CHECK (email = auth.email());

-- Note: No DELETE policies for managers/workers - only super admins can delete
-- This preserves audit trail and prevents accidental data loss