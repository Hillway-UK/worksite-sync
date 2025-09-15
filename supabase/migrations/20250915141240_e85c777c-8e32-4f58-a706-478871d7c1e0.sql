-- Fix security vulnerability in demo_requests table
-- Ensure customer contact information is only accessible by authorized personnel

-- Drop existing policies to rebuild with explicit security controls
DROP POLICY IF EXISTS "Authenticated managers can view demo requests" ON public.demo_requests;
DROP POLICY IF EXISTS "Authenticated managers can update demo requests" ON public.demo_requests;
DROP POLICY IF EXISTS "Public can create demo requests" ON public.demo_requests;

-- 1. Only authenticated managers and super admins can view sensitive customer data
CREATE POLICY "Only managers and super admins can view demo requests" 
ON public.demo_requests 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = auth.email()
  ) OR EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
);

-- 2. Only authenticated managers and super admins can update demo request status
CREATE POLICY "Only managers and super admins can update demo requests" 
ON public.demo_requests 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = auth.email()
  ) OR EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = auth.email()
  ) OR EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
);

-- 3. Allow public to create demo requests (necessary for demo request form)
CREATE POLICY "Public can create demo requests" 
ON public.demo_requests 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- 4. No DELETE policy - preserve all demo requests for audit trail
-- This ensures demo requests cannot be deleted by anyone through the application

-- This security fix ensures:
-- - Customer contact info (emails, phone, company names) only visible to authorized staff
-- - Competitors and unauthorized users completely blocked from harvesting sales leads
-- - Demo request form still functions for public users
-- - Audit trail is preserved (no deletions allowed)