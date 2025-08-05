-- Add RLS policy to allow authenticated users to read managers table
CREATE POLICY "Allow authenticated users to read managers"
ON public.managers
FOR SELECT
TO authenticated
USING (true);

-- Also add a policy for workers table to be consistent
CREATE POLICY "Allow authenticated users to read workers"
ON public.workers
FOR SELECT
TO authenticated
USING (true);