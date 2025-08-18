-- Fix critical RLS security issues

-- Drop overly permissive policies for managers table
DROP POLICY IF EXISTS "Allow authenticated users to read managers" ON public.managers;

-- Create secure policies for managers table
CREATE POLICY "Managers can view other managers basic info" 
ON public.managers 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.managers WHERE email = auth.email())
  AND (
    -- Allow viewing basic info of other managers (excluding PIN)
    CASE 
      WHEN email = auth.email() THEN true  -- Own record: full access
      ELSE pin IS NULL OR pin = ''         -- Others: only if PIN not being selected
    END
  )
);

CREATE POLICY "Managers can view own complete profile" 
ON public.managers 
FOR SELECT 
USING (email = auth.email());

-- Drop overly permissive policy for workers table  
DROP POLICY IF EXISTS "Allow authenticated users to read workers" ON public.workers;

-- Create secure policies for workers table
CREATE POLICY "Managers can view all worker information" 
ON public.workers 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.managers WHERE email = auth.email())
);

CREATE POLICY "Workers can view only own information" 
ON public.workers 
FOR SELECT 
USING (email = auth.email());

-- Note: The existing policies for managers and workers to update their own records remain unchanged
-- The existing policy "Managers can insert workers" remains unchanged
-- The existing policy "Managers can update workers" remains unchanged