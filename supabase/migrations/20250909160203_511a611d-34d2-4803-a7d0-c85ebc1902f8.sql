-- Fix security vulnerability in demo_requests table
-- Strengthen RLS policies to ensure only authenticated managers and super admins can access customer data

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can create demo requests" ON public.demo_requests;
DROP POLICY IF EXISTS "Managers can view all demo requests" ON public.demo_requests;

-- Create more secure policies
-- Allow unauthenticated users to create demo requests (for public form)
CREATE POLICY "Public can create demo requests" 
ON public.demo_requests 
FOR INSERT 
TO public
WITH CHECK (true);

-- Only authenticated managers and super admins can view demo requests
CREATE POLICY "Authenticated managers can view demo requests" 
ON public.demo_requests 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = auth.email()
  ) 
  OR 
  EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
);

-- Only authenticated managers and super admins can update demo requests (for status changes)
CREATE POLICY "Authenticated managers can update demo requests" 
ON public.demo_requests 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = auth.email()
  ) 
  OR 
  EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = auth.email()
  ) 
  OR 
  EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = auth.email()
  )
);

-- Ensure no one can delete demo requests (preserve audit trail)
-- No DELETE policy = no one can delete