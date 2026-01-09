-- Migration: Create report_line_items table for editable weekly report line items
-- Run this in your Supabase SQL Editor

-- Create the report_line_items table
CREATE TABLE IF NOT EXISTS public.report_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  week_start DATE NOT NULL,
  worker_id UUID REFERENCES public.workers(id) NOT NULL,
  work_date DATE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('work', 'overtime', 'expense')),
  expense_type TEXT,  -- Only populated for expense entries
  quantity DECIMAL(10,2) NOT NULL,
  unit_amount DECIMAL(10,2) NOT NULL,
  project_id UUID REFERENCES public.jobs(id),
  project_name TEXT,  -- Denormalized for display
  account_code TEXT DEFAULT '5000',
  tax_type TEXT DEFAULT '20% VAT',
  description_generated TEXT,  -- Auto-generated from rules
  source_clock_entry_id UUID REFERENCES public.clock_entries(id),  -- Original source
  source_additional_cost_id UUID REFERENCES public.additional_costs(id),  -- Original source
  is_deleted BOOLEAN DEFAULT false,  -- Soft delete
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_report_line_items_week ON public.report_line_items(organization_id, week_start);
CREATE INDEX IF NOT EXISTS idx_report_line_items_worker ON public.report_line_items(worker_id);
CREATE INDEX IF NOT EXISTS idx_report_line_items_source_clock ON public.report_line_items(source_clock_entry_id);
CREATE INDEX IF NOT EXISTS idx_report_line_items_source_cost ON public.report_line_items(source_additional_cost_id);

-- Enable RLS
ALTER TABLE public.report_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Managers can only access their organization's line items
CREATE POLICY "Managers can view their organization line items"
  ON public.report_line_items
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.managers WHERE email = auth.jwt() ->> 'email'
    )
    OR
    organization_id IN (
      SELECT organization_id FROM public.super_admins WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Managers can insert their organization line items"
  ON public.report_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.managers WHERE email = auth.jwt() ->> 'email'
    )
    OR
    organization_id IN (
      SELECT organization_id FROM public.super_admins WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Managers can update their organization line items"
  ON public.report_line_items
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.managers WHERE email = auth.jwt() ->> 'email'
    )
    OR
    organization_id IN (
      SELECT organization_id FROM public.super_admins WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Managers can delete their organization line items"
  ON public.report_line_items
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.managers WHERE email = auth.jwt() ->> 'email'
    )
    OR
    organization_id IN (
      SELECT organization_id FROM public.super_admins WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_report_line_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_report_line_items_updated_at ON public.report_line_items;
CREATE TRIGGER trigger_update_report_line_items_updated_at
  BEFORE UPDATE ON public.report_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_report_line_items_updated_at();

-- Grant permissions
GRANT ALL ON public.report_line_items TO authenticated;
GRANT ALL ON public.report_line_items TO service_role;
