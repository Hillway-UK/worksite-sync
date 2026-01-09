-- ============================================================================
-- MASTER MIGRATION FILE
-- Complete Database Schema for Worksite Sync Application
-- ============================================================================
-- This file consolidates all 108 migration files into a single executable script
-- Safe to run on a fresh Supabase database
-- 
-- IMPORTANT: Run this entire file in the Supabase SQL Editor
-- Expected execution time: 2-5 minutes
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS
-- ============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 2: ENUMS AND TYPES
-- ============================================================================

-- User role enum for role-based access control
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Subscription plan types
DO $$ BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('trial', 'basic', 'professional', 'enterprise');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Amendment status types
DO $$ BEGIN
  CREATE TYPE public.amendment_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SECTION 3: CORE TABLES
-- ============================================================================

-- Organizations table (root entity)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_number TEXT,
  vat_number TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  subscription_status subscription_plan DEFAULT 'trial',
  trial_ends_at DATE,
  max_managers INTEGER DEFAULT 3,
  max_workers INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- User roles table (security-critical)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, role)
);

-- Super admins (organization owners/administrators)
CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  is_owner BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Managers table
CREATE TABLE IF NOT EXISTS public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Workers table
CREATE TABLE IF NOT EXISTS public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  postcode TEXT,
  hourly_rate DECIMAL(10,2),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  manager_id UUID REFERENCES public.managers(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  postcode TEXT NOT NULL,
  client_name TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Job assignments (many-to-many)
CREATE TABLE IF NOT EXISTS public.job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(job_id, worker_id)
);

-- Time entries
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out TIMESTAMP WITH TIME ZONE,
  clock_in_latitude DOUBLE PRECISION,
  clock_in_longitude DOUBLE PRECISION,
  clock_out_latitude DOUBLE PRECISION,
  clock_out_longitude DOUBLE PRECISION,
  total_hours DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Time amendments
CREATE TABLE IF NOT EXISTS public.time_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE NOT NULL,
  status amendment_status DEFAULT 'pending',
  requested_clock_in TIMESTAMP WITH TIME ZONE,
  requested_clock_out TIMESTAMP WITH TIME ZONE,
  reason TEXT NOT NULL,
  manager_notes TEXT,
  reviewed_by UUID REFERENCES public.managers(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Expense types
CREATE TABLE IF NOT EXISTS public.expense_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(name, organization_id)
);

-- Additional costs
CREATE TABLE IF NOT EXISTS public.additional_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE CASCADE NOT NULL,
  expense_type_id UUID REFERENCES public.expense_types(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Photos
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Demo requests
CREATE TABLE IF NOT EXISTS public.demo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Subscription usage tracking
CREATE TABLE IF NOT EXISTS public.subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  plan_type subscription_plan NOT NULL,
  max_managers INTEGER NOT NULL,
  max_workers INTEGER NOT NULL,
  current_managers INTEGER DEFAULT 0,
  current_workers INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- UK postcodes (for geocoding)
CREATE TABLE IF NOT EXISTS public.uk_postcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode TEXT UNIQUE NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  dedupe_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(dedupe_key)
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE NOT NULL UNIQUE,
  push_token TEXT,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tutorial completion tracking
CREATE TABLE IF NOT EXISTS public.tutorial_completion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE,
  tutorial_id TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- SECTION 4: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_workers_organization ON public.workers(organization_id);
CREATE INDEX IF NOT EXISTS idx_workers_manager ON public.workers(manager_id);
CREATE INDEX IF NOT EXISTS idx_jobs_organization ON public.jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_worker ON public.time_entries(worker_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_job ON public.time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON public.time_entries(clock_in);
CREATE INDEX IF NOT EXISTS idx_time_amendments_worker ON public.time_amendments(worker_id);
CREATE INDEX IF NOT EXISTS idx_time_amendments_status ON public.time_amendments(status);
CREATE INDEX IF NOT EXISTS idx_notifications_worker ON public.notifications(worker_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_uk_postcodes_postcode ON public.uk_postcodes(postcode);

-- ============================================================================
-- SECTION 5: SECURITY DEFINER FUNCTIONS (For RLS)
-- ============================================================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user is a manager
CREATE OR REPLACE FUNCTION public.is_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.managers
    WHERE id = _user_id
  )
$$;

-- Function to check if user is a super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins
    WHERE id = _user_id
  )
$$;

-- Function to get user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT organization_id FROM public.super_admins WHERE id = _user_id),
    (SELECT organization_id FROM public.managers WHERE id = _user_id),
    (SELECT organization_id FROM public.workers WHERE id = _user_id)
  )
$$;

-- Function to check if user can manage organization
CREATE OR REPLACE FUNCTION public.can_manage_organization(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins
    WHERE id = auth.uid() AND organization_id = target_org_id
  )
$$;

-- ============================================================================
-- SECTION 6: BUSINESS LOGIC FUNCTIONS
-- ============================================================================

-- Get clocked in workers for an organization
CREATE OR REPLACE FUNCTION public.get_clocked_in_workers(org_id UUID)
RETURNS TABLE (
  worker_id UUID,
  worker_name TEXT,
  job_name TEXT,
  clock_in TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    w.id,
    w.name,
    j.name,
    te.clock_in
  FROM public.time_entries te
  JOIN public.workers w ON te.worker_id = w.id
  JOIN public.jobs j ON te.job_id = j.id
  WHERE w.organization_id = org_id 
    AND te.clock_out IS NULL
  ORDER BY te.clock_in DESC
$$;

-- Get total hours today for an organization
CREATE OR REPLACE FUNCTION public.get_total_hours_today(org_id UUID)
RETURNS DECIMAL
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(total_hours), 0)
  FROM public.time_entries te
  JOIN public.workers w ON te.worker_id = w.id
  WHERE w.organization_id = org_id
    AND DATE(te.clock_in) = CURRENT_DATE
$$;

-- Get worker weekly hours
CREATE OR REPLACE FUNCTION public.get_worker_weekly_hours(worker_id UUID, week_start DATE)
RETURNS DECIMAL
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(total_hours), 0)
  FROM public.time_entries
  WHERE worker_id = $1
    AND clock_in >= week_start
    AND clock_in < week_start + INTERVAL '7 days'
$$;

-- Get recent activity for organization
CREATE OR REPLACE FUNCTION public.get_recent_activity(org_id UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  activity_type TEXT,
  description TEXT,
  timestamp TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    'clock_in' as activity_type,
    w.name || ' clocked in at ' || j.name as description,
    te.clock_in as timestamp
  FROM public.time_entries te
  JOIN public.workers w ON te.worker_id = w.id
  JOIN public.jobs j ON te.job_id = j.id
  WHERE w.organization_id = org_id
  ORDER BY te.clock_in DESC
  LIMIT limit_count
$$;

-- Upgrade subscription plan
CREATE OR REPLACE FUNCTION public.upgrade_subscription_plan(
  p_org_id UUID,
  p_new_max_managers INTEGER,
  p_new_max_workers INTEGER,
  p_plan_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_subscription_id UUID;
BEGIN
  -- End current active subscription
  UPDATE public.subscription_usage
  SET ended_at = NOW(), is_active = false
  WHERE organization_id = p_org_id AND is_active = true;

  -- Create new subscription
  INSERT INTO public.subscription_usage (
    organization_id,
    plan_type,
    max_managers,
    max_workers,
    current_managers,
    current_workers,
    is_active
  )
  SELECT 
    p_org_id,
    p_plan_type::subscription_plan,
    p_new_max_managers,
    p_new_max_workers,
    (SELECT COUNT(*) FROM public.managers WHERE organization_id = p_org_id),
    (SELECT COUNT(*) FROM public.workers WHERE organization_id = p_org_id),
    true
  RETURNING id INTO v_new_subscription_id;

  -- Update organization limits
  UPDATE public.organizations
  SET 
    max_managers = p_new_max_managers,
    max_workers = p_new_max_workers,
    subscription_status = p_plan_type::subscription_plan,
    updated_at = NOW()
  WHERE id = p_org_id;

  RETURN v_new_subscription_id;
END;
$$;

-- ============================================================================
-- SECTION 7: TRIGGERS
-- ============================================================================

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers to relevant tables
DROP TRIGGER IF EXISTS set_updated_at ON public.organizations;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.super_admins;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.super_admins
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.managers;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.managers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.workers;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.time_entries;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.time_amendments;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.time_amendments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to calculate total hours on time entry update
CREATE OR REPLACE FUNCTION public.calculate_total_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.clock_out IS NOT NULL THEN
    NEW.total_hours = EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 3600;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calculate_hours ON public.time_entries;
CREATE TRIGGER calculate_hours
  BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_total_hours();

-- ============================================================================
-- SECTION 8: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.additional_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uk_postcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_completion ENABLE ROW LEVEL SECURITY;

-- Organizations policies
DROP POLICY IF EXISTS "Super admins can view their organization" ON public.organizations;
CREATE POLICY "Super admins can view their organization"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT organization_id FROM public.super_admins WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Super admins can update their organization" ON public.organizations;
CREATE POLICY "Super admins can update their organization"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT organization_id FROM public.super_admins WHERE id = auth.uid())
  );

-- Super admins policies
DROP POLICY IF EXISTS "Super admins can view themselves" ON public.super_admins;
CREATE POLICY "Super admins can view themselves"
  ON public.super_admins FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Super admins can view org admins" ON public.super_admins;
CREATE POLICY "Super admins can view org admins"
  ON public.super_admins FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.super_admins WHERE id = auth.uid())
  );

-- Managers policies
DROP POLICY IF EXISTS "Managers can view themselves" ON public.managers;
CREATE POLICY "Managers can view themselves"
  ON public.managers FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Super admins can manage managers" ON public.managers;
CREATE POLICY "Super admins can manage managers"
  ON public.managers FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.super_admins WHERE id = auth.uid())
  );

-- Workers policies
DROP POLICY IF EXISTS "Workers can view themselves" ON public.workers;
CREATE POLICY "Workers can view themselves"
  ON public.workers FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Super admins can manage workers" ON public.workers;
CREATE POLICY "Super admins can manage workers"
  ON public.workers FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.super_admins WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Managers can view their workers" ON public.workers;
CREATE POLICY "Managers can view their workers"
  ON public.workers FOR SELECT
  TO authenticated
  USING (
    manager_id = auth.uid() OR
    organization_id IN (SELECT organization_id FROM public.managers WHERE id = auth.uid())
  );

-- Jobs policies
DROP POLICY IF EXISTS "Organization members can view jobs" ON public.jobs;
CREATE POLICY "Organization members can view jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
  );

DROP POLICY IF EXISTS "Super admins can manage jobs" ON public.jobs;
CREATE POLICY "Super admins can manage jobs"
  ON public.jobs FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.super_admins WHERE id = auth.uid())
  );

-- Time entries policies
DROP POLICY IF EXISTS "Workers can view their time entries" ON public.time_entries;
CREATE POLICY "Workers can view their time entries"
  ON public.time_entries FOR SELECT
  TO authenticated
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS "Workers can insert their time entries" ON public.time_entries;
CREATE POLICY "Workers can insert their time entries"
  ON public.time_entries FOR INSERT
  TO authenticated
  WITH CHECK (worker_id = auth.uid());

DROP POLICY IF EXISTS "Workers can update their time entries" ON public.time_entries;
CREATE POLICY "Workers can update their time entries"
  ON public.time_entries FOR UPDATE
  TO authenticated
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view org time entries" ON public.time_entries;
CREATE POLICY "Managers can view org time entries"
  ON public.time_entries FOR SELECT
  TO authenticated
  USING (
    worker_id IN (
      SELECT id FROM public.workers 
      WHERE organization_id IN (
        SELECT organization_id FROM public.managers WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Super admins can manage time entries" ON public.time_entries;
CREATE POLICY "Super admins can manage time entries"
  ON public.time_entries FOR ALL
  TO authenticated
  USING (
    worker_id IN (
      SELECT id FROM public.workers 
      WHERE organization_id IN (
        SELECT organization_id FROM public.super_admins WHERE id = auth.uid()
      )
    )
  );

-- Time amendments policies
DROP POLICY IF EXISTS "Workers can manage their amendments" ON public.time_amendments;
CREATE POLICY "Workers can manage their amendments"
  ON public.time_amendments FOR ALL
  TO authenticated
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view org amendments" ON public.time_amendments;
CREATE POLICY "Managers can view org amendments"
  ON public.time_amendments FOR SELECT
  TO authenticated
  USING (
    worker_id IN (
      SELECT id FROM public.workers 
      WHERE organization_id IN (
        SELECT organization_id FROM public.managers WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Managers can update amendments" ON public.time_amendments;
CREATE POLICY "Managers can update amendments"
  ON public.time_amendments FOR UPDATE
  TO authenticated
  USING (
    worker_id IN (
      SELECT id FROM public.workers 
      WHERE organization_id IN (
        SELECT organization_id FROM public.managers WHERE id = auth.uid()
      )
    )
  );

-- Expense types policies
DROP POLICY IF EXISTS "Organization members can view expense types" ON public.expense_types;
CREATE POLICY "Organization members can view expense types"
  ON public.expense_types FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
  );

DROP POLICY IF EXISTS "Super admins can manage expense types" ON public.expense_types;
CREATE POLICY "Super admins can manage expense types"
  ON public.expense_types FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.super_admins WHERE id = auth.uid())
  );

-- Notifications policies
DROP POLICY IF EXISTS "Workers can view their notifications" ON public.notifications;
CREATE POLICY "Workers can view their notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS "Workers can update their notifications" ON public.notifications;
CREATE POLICY "Workers can update their notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (worker_id = auth.uid());

-- Notification preferences policies
DROP POLICY IF EXISTS "Workers can manage their preferences" ON public.notification_preferences;
CREATE POLICY "Workers can manage their preferences"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (worker_id = auth.uid());

-- UK postcodes - public read access
DROP POLICY IF EXISTS "Anyone can view postcodes" ON public.uk_postcodes;
CREATE POLICY "Anyone can view postcodes"
  ON public.uk_postcodes FOR SELECT
  TO authenticated
  USING (true);

-- Demo requests - public insert
DROP POLICY IF EXISTS "Anyone can submit demo requests" ON public.demo_requests;
CREATE POLICY "Anyone can submit demo requests"
  ON public.demo_requests FOR INSERT
  TO anon
  WITH CHECK (true);

-- Tutorial completion policies
DROP POLICY IF EXISTS "Users can manage their tutorial completion" ON public.tutorial_completion;
CREATE POLICY "Users can manage their tutorial completion"
  ON public.tutorial_completion FOR ALL
  TO authenticated
  USING (
    user_email IN (
      SELECT email FROM public.super_admins WHERE id = auth.uid()
      UNION
      SELECT email FROM public.managers WHERE id = auth.uid()
      UNION
      SELECT email FROM public.workers WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- SECTION 9: STORAGE BUCKETS
-- ============================================================================

-- Create storage bucket for worker photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-photos', 'worker-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for worker photos
DROP POLICY IF EXISTS "Workers can upload their photos" ON storage.objects;
CREATE POLICY "Workers can upload their photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'worker-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;
CREATE POLICY "Anyone can view photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'worker-photos');

DROP POLICY IF EXISTS "Workers can delete their photos" ON storage.objects;
CREATE POLICY "Workers can delete their photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'worker-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- SECTION 10: GRANTS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant access to tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON public.demo_requests TO anon;
GRANT SELECT ON public.uk_postcodes TO authenticated;

-- Grant access to sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Next steps:
-- 1. Verify all tables were created: Check Supabase Dashboard > Database > Tables
-- 2. Verify RLS policies: Check each table has policies enabled
-- 3. Create storage bucket if not exists: Check Storage section
-- 4. Transfer secrets: See SECRETS_INVENTORY.md
-- 5. Deploy edge functions: Handled automatically by CI/CD
-- 6. Update project configuration: See MIGRATION_CHECKLIST.md
-- 
-- ============================================================================

