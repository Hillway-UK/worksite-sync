-- Add global show_rams_and_site_info toggle column to jobs table
-- This controls visibility of RAMS and Site Info documents in the worker app
-- Run this migration in the Supabase SQL Editor

-- Step 1: Add new column to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS show_rams_and_site_info BOOLEAN DEFAULT true;

-- Step 2: Backfill all existing jobs to show documents by default
UPDATE jobs 
SET show_rams_and_site_info = true 
WHERE show_rams_and_site_info IS NULL;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN jobs.show_rams_and_site_info IS 'Controls visibility of RAMS and Site Info documents in worker app';

-- Verification Query
-- Run this to verify the changes were applied successfully:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'jobs' 
-- AND column_name = 'show_rams_and_site_info';
