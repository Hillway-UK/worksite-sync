-- SQL Script: Add Job Document Support
-- Description: Adds terms_and_conditions_url and waiver_url fields to jobs table and creates storage bucket
-- Run this script in the Supabase SQL Editor

-- Step 1: Add document URL fields to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS terms_and_conditions_url TEXT,
ADD COLUMN IF NOT EXISTS waiver_url TEXT;

-- Step 2: Create storage bucket for job documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-documents', 'job-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Step 3: RLS policies for job-documents bucket

-- Managers can upload job documents
CREATE POLICY "Managers can upload job documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-documents' AND
  (auth.uid() IN (SELECT id FROM auth.users WHERE email IN (SELECT email FROM managers)))
);

-- Managers can update job documents
CREATE POLICY "Managers can update job documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'job-documents' AND
  (auth.uid() IN (SELECT id FROM auth.users WHERE email IN (SELECT email FROM managers)))
);

-- Managers can delete job documents
CREATE POLICY "Managers can delete job documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'job-documents' AND
  (auth.uid() IN (SELECT id FROM auth.users WHERE email IN (SELECT email FROM managers)))
);

-- Everyone can view job documents
CREATE POLICY "Everyone can view job documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'job-documents');

-- Step 4: Add comments for documentation
COMMENT ON COLUMN jobs.terms_and_conditions_url IS 'URL to stored terms and conditions document (PDF, DOC, TXT)';
COMMENT ON COLUMN jobs.waiver_url IS 'URL to stored waiver/consent form document (PDF, DOC, TXT)';

-- Verification Query
-- Run this to verify the changes were applied successfully:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'jobs' 
-- AND column_name IN ('terms_and_conditions_url', 'waiver_url');
