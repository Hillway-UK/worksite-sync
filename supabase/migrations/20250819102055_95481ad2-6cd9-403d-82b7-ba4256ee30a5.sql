-- Create demo_requests table to store demo request submissions
CREATE TABLE public.demo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Create policy for managers to view demo requests
CREATE POLICY "Managers can view all demo requests" 
ON public.demo_requests 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.managers 
  WHERE email = auth.email()
));

-- Create policy for edge functions to insert demo requests
CREATE POLICY "Insert demo requests" 
ON public.demo_requests 
FOR INSERT 
WITH CHECK (true);

-- Update organizations table to remove trial by default
ALTER TABLE public.organizations 
ALTER COLUMN subscription_status SET DEFAULT 'inactive';

-- Remove default trial end date since we're requiring immediate payment
ALTER TABLE public.organizations 
ALTER COLUMN trial_ends_at DROP DEFAULT;