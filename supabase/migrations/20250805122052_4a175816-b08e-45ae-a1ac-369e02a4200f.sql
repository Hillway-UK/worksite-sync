-- Add missing fields to workers table
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS emergency_contact text,
ADD COLUMN IF NOT EXISTS emergency_phone text,
ADD COLUMN IF NOT EXISTS date_started date DEFAULT CURRENT_DATE;

-- Create time_amendments table
CREATE TABLE IF NOT EXISTS public.time_amendments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clock_entry_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  requested_clock_in timestamp with time zone,
  requested_clock_out timestamp with time zone,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  manager_notes text,
  manager_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone
);

-- Enable RLS on time_amendments
ALTER TABLE public.time_amendments ENABLE ROW LEVEL SECURITY;

-- Workers can manage own amendments
CREATE POLICY "Workers can manage own amendments" 
ON public.time_amendments 
FOR ALL 
USING (worker_id IN (
  SELECT workers.id FROM workers WHERE workers.email = auth.email()
));

-- Managers can manage all amendments
CREATE POLICY "Managers can manage all amendments" 
ON public.time_amendments 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM managers WHERE managers.email = auth.email()
));

-- Allow workers to update their own profile information
CREATE POLICY "Workers can update own profile" 
ON public.workers 
FOR UPDATE 
USING (auth.email() = email)
WITH CHECK (auth.email() = email);

-- Allow managers to insert/update workers
CREATE POLICY "Managers can manage workers" 
ON public.workers 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM managers WHERE managers.email = auth.email()
));