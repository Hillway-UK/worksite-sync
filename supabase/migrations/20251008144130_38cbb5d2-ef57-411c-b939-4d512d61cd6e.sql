-- Add logo_url column to organizations table
ALTER TABLE public.organizations ADD COLUMN logo_url TEXT;

-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('organization-logos', 'organization-logos', true);

-- RLS policies for storage
CREATE POLICY "Public can view organization logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-logos');

CREATE POLICY "Super admins can upload organization logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'organization-logos' 
  AND EXISTS (SELECT 1 FROM public.super_admins WHERE email = auth.email())
);

CREATE POLICY "Super admins can update organization logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'organization-logos'
  AND EXISTS (SELECT 1 FROM public.super_admins WHERE email = auth.email())
);

CREATE POLICY "Super admins can delete organization logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'organization-logos'
  AND EXISTS (SELECT 1 FROM public.super_admins WHERE email = auth.email())
);