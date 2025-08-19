-- Create organizations table
CREATE TABLE public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company_number TEXT,
  vat_number TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  subscription_status TEXT DEFAULT 'trial',
  subscription_start_date DATE,
  subscription_end_date DATE,
  trial_ends_at DATE DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  max_workers INTEGER DEFAULT 10,
  max_managers INTEGER DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create super admins table
CREATE TABLE public.super_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  is_owner BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscription usage tracking
CREATE TABLE public.subscription_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  active_workers INTEGER DEFAULT 0,
  active_managers INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2),
  billed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add organization reference to existing tables
ALTER TABLE public.managers ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE public.workers ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE public.jobs ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Super admins can manage their organization" ON public.organizations
  FOR ALL USING (id IN (
    SELECT organization_id FROM super_admins WHERE email = auth.email()
  ));

CREATE POLICY "Organization members can view their org" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM managers WHERE email = auth.email()
      UNION
      SELECT organization_id FROM workers WHERE email = auth.email()
    )
  );

-- RLS Policies for super_admins
CREATE POLICY "Super admins can view own record" ON public.super_admins
  FOR SELECT USING (email = auth.email());

CREATE POLICY "Super admins can manage same org admins" ON public.super_admins
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM super_admins WHERE email = auth.email()
  ));

-- RLS Policies for subscription_usage
CREATE POLICY "Super admins can view org usage" ON public.subscription_usage
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM super_admins WHERE email = auth.email()
  ));

-- Update existing RLS policies to include organization scoping
DROP POLICY IF EXISTS "Managers can manage jobs" ON public.jobs;
DROP POLICY IF EXISTS "Managers can update jobs" ON public.jobs;
DROP POLICY IF EXISTS "Managers can insert jobs" ON public.jobs;

CREATE POLICY "Managers can manage organization jobs" ON public.jobs
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM managers WHERE email = auth.email()
    )
  );

DROP POLICY IF EXISTS "Managers can view all workers" ON public.workers;
DROP POLICY IF EXISTS "Managers can update workers" ON public.workers;
DROP POLICY IF EXISTS "Managers can insert workers" ON public.workers;

CREATE POLICY "Managers can manage organization workers" ON public.workers
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM managers WHERE email = auth.email()
    ) OR email = auth.email()
  );

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = user_email
  );
$$;

-- Helper function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization_id(user_email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT organization_id FROM public.super_admins WHERE email = user_email),
    (SELECT organization_id FROM public.managers WHERE email = user_email),
    (SELECT organization_id FROM public.workers WHERE email = user_email)
  );
$$;