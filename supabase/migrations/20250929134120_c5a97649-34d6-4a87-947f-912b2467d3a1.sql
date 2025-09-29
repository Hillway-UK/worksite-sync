-- Create postcodes table for local UK postcode database
CREATE TABLE public.postcodes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  postcode text NOT NULL UNIQUE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  town text,
  county text,
  country text DEFAULT 'United Kingdom',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for fast postcode lookups
CREATE INDEX idx_postcodes_postcode ON public.postcodes(postcode);
CREATE INDEX idx_postcodes_location ON public.postcodes(latitude, longitude);

-- Enable RLS
ALTER TABLE public.postcodes ENABLE ROW LEVEL SECURITY;

-- Create policies for postcode access
CREATE POLICY "Anyone can read postcodes" 
ON public.postcodes 
FOR SELECT 
USING (true);

CREATE POLICY "Only managers can insert postcodes" 
ON public.postcodes 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.managers 
  WHERE email = auth.email()
));