-- Fix infinite recursion by dropping ALL existing problematic policies and recreating them properly

-- Create security definer function to check if user is a manager (if not exists)
CREATE OR REPLACE FUNCTION public.is_manager(user_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = user_email
  );
$$;

-- Drop ALL existing SELECT policies for managers table
DROP POLICY IF EXISTS "Allow authenticated users to read managers" ON public.managers;
DROP POLICY IF EXISTS "Managers can view other managers basic info" ON public.managers;
DROP POLICY IF EXISTS "Managers can view own complete profile" ON public.managers;
DROP POLICY IF EXISTS "Managers can view all managers" ON public.managers;

-- Drop ALL existing SELECT policies for workers table  
DROP POLICY IF EXISTS "Allow authenticated users to read workers" ON public.workers;
DROP POLICY IF EXISTS "Managers can view all worker information" ON public.workers;
DROP POLICY IF EXISTS "Workers can view only own information" ON public.workers;
DROP POLICY IF EXISTS "Managers can view all workers" ON public.workers;
DROP POLICY IF EXISTS "Workers can view own record" ON public.workers;
DROP POLICY IF EXISTS "Workers can view their own record" ON public.workers;

-- Create new secure policies using the security definer function
CREATE POLICY "Managers can view all managers" 
ON public.managers 
FOR SELECT 
USING (public.is_manager(auth.email()));

CREATE POLICY "Managers can view all workers" 
ON public.workers 
FOR SELECT 
USING (public.is_manager(auth.email()));

CREATE POLICY "Workers can view own record" 
ON public.workers 
FOR SELECT 
USING (email = auth.email());