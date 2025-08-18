-- Add approver tracking to time amendments
ALTER TABLE time_amendments 
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;