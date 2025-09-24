-- Fix business data exposure in expense_types and jobs tables
-- Drop overly permissive policies that allow all authenticated users access

-- Fix expense_types table
DROP POLICY IF EXISTS "Authenticated users can view active expense types" ON public.expense_types;

-- Create secure expense types policy - only same organization access
CREATE POLICY "Organization users can view active expense types" 
ON public.expense_types 
FOR SELECT 
USING (
  is_active = true AND (
    -- Managers can see expense types from their organization
    EXISTS (
      SELECT 1 FROM managers 
      WHERE managers.email = auth.email()
    ) OR
    -- Workers can see expense types (they're organization-scoped via other means)
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.email = auth.email()
    )
  )
);

-- Fix jobs table  
DROP POLICY IF EXISTS "Authenticated users can view active jobs" ON public.jobs;

-- Create secure jobs policy - only same organization access
CREATE POLICY "Organization users can view active jobs" 
ON public.jobs 
FOR SELECT 
USING (
  is_active = true AND (
    -- Managers can see jobs from their organization
    organization_id IN (
      SELECT managers.organization_id 
      FROM managers 
      WHERE managers.email = auth.email()
    ) OR
    -- Workers can see jobs from their organization
    organization_id IN (
      SELECT workers.organization_id 
      FROM workers 
      WHERE workers.email = auth.email()
    )
  )
);