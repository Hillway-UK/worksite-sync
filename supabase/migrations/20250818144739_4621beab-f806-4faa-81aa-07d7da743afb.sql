-- Add structured address columns to jobs table
ALTER TABLE public.jobs 
ADD COLUMN address_line_1 text,
ADD COLUMN address_line_2 text,
ADD COLUMN city text,
ADD COLUMN county text,
ADD COLUMN postcode text;