-- Phase 1: Fix subscription_usage policies for global super admin access
DROP POLICY IF EXISTS "Super admins can view org usage" ON public.subscription_usage;
DROP POLICY IF EXISTS "Super admins can update org usage" ON public.subscription_usage;
DROP POLICY IF EXISTS "Super admins can delete org usage" ON public.subscription_usage;
DROP POLICY IF EXISTS "Super admins can create subscription usage" ON public.subscription_usage;

CREATE POLICY "Super admins can view all subscription usage"
ON public.subscription_usage FOR SELECT
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can update all subscription usage"
ON public.subscription_usage FOR UPDATE
USING (is_super_admin(auth.email()))
WITH CHECK (is_super_admin(auth.email()));

CREATE POLICY "Super admins can delete all subscription usage"
ON public.subscription_usage FOR DELETE
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can create all subscription usage"
ON public.subscription_usage FOR INSERT
WITH CHECK (is_super_admin(auth.email()));

-- Phase 2: Fix workers table policies
DROP POLICY IF EXISTS "Managers can view organization workers" ON public.workers;
DROP POLICY IF EXISTS "Managers can update organization workers" ON public.workers;
DROP POLICY IF EXISTS "Managers can create organization workers" ON public.workers;

CREATE POLICY "Managers and super admins can view workers"
ON public.workers FOR SELECT
USING (
  user_is_manager_in_org(organization_id) 
  OR user_is_super_admin_in_org(organization_id)
  OR is_super_admin(auth.email())
);

CREATE POLICY "Managers and super admins can update workers"
ON public.workers FOR UPDATE
USING (
  user_is_manager_in_org(organization_id) 
  OR user_is_super_admin_in_org(organization_id)
  OR is_super_admin(auth.email())
)
WITH CHECK (
  user_is_manager_in_org(organization_id) 
  OR user_is_super_admin_in_org(organization_id)
  OR is_super_admin(auth.email())
);

CREATE POLICY "Managers and super admins can create workers"
ON public.workers FOR INSERT
WITH CHECK (
  user_is_manager_in_org(organization_id) 
  OR user_is_super_admin_in_org(organization_id)
  OR is_super_admin(auth.email())
);

-- Phase 3: Fix jobs table policies
DROP POLICY IF EXISTS "Managers can view organization jobs" ON public.jobs;
DROP POLICY IF EXISTS "Managers can create organization jobs" ON public.jobs;
DROP POLICY IF EXISTS "Managers can update organization jobs" ON public.jobs;
DROP POLICY IF EXISTS "Managers can delete organization jobs" ON public.jobs;

CREATE POLICY "Managers and super admins can view jobs"
ON public.jobs FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM managers WHERE email = auth.email())
  OR is_super_admin(auth.email())
);

CREATE POLICY "Managers and super admins can create jobs"
ON public.jobs FOR INSERT
WITH CHECK (
  organization_id IN (SELECT organization_id FROM managers WHERE email = auth.email())
  OR is_super_admin(auth.email())
);

CREATE POLICY "Managers and super admins can update jobs"
ON public.jobs FOR UPDATE
USING (
  organization_id IN (SELECT organization_id FROM managers WHERE email = auth.email())
  OR is_super_admin(auth.email())
)
WITH CHECK (
  organization_id IN (SELECT organization_id FROM managers WHERE email = auth.email())
  OR is_super_admin(auth.email())
);

CREATE POLICY "Managers and super admins can delete jobs"
ON public.jobs FOR DELETE
USING (
  organization_id IN (SELECT organization_id FROM managers WHERE email = auth.email())
  OR is_super_admin(auth.email())
);

-- Phase 4: Fix clock_entries policies
CREATE POLICY "Super admins can view all clock entries"
ON public.clock_entries FOR SELECT
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can update all clock entries"
ON public.clock_entries FOR UPDATE
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can delete all clock entries"
ON public.clock_entries FOR DELETE
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can create clock entries"
ON public.clock_entries FOR INSERT
WITH CHECK (is_super_admin(auth.email()));

-- Phase 5: Fix time_amendments policies
CREATE POLICY "Super admins can view all time amendments"
ON public.time_amendments FOR SELECT
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can update all time amendments"
ON public.time_amendments FOR UPDATE
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can delete all time amendments"
ON public.time_amendments FOR DELETE
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can create time amendments"
ON public.time_amendments FOR INSERT
WITH CHECK (is_super_admin(auth.email()));

-- Phase 6: Fix additional_costs policies
CREATE POLICY "Super admins can view all additional costs"
ON public.additional_costs FOR SELECT
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can update all additional costs"
ON public.additional_costs FOR UPDATE
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can delete all additional costs"
ON public.additional_costs FOR DELETE
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can create additional costs"
ON public.additional_costs FOR INSERT
WITH CHECK (is_super_admin(auth.email()));

-- Phase 7: Fix expense_types policies
CREATE POLICY "Super admins can view all expense types"
ON public.expense_types FOR SELECT
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can update all expense types"
ON public.expense_types FOR UPDATE
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can delete all expense types"
ON public.expense_types FOR DELETE
USING (is_super_admin(auth.email()));

CREATE POLICY "Super admins can create all expense types"
ON public.expense_types FOR INSERT
WITH CHECK (is_super_admin(auth.email()));

-- Phase 8: Fix subscription_audit_log policies
CREATE POLICY "Super admins can view all subscription audit logs"
ON public.subscription_audit_log FOR SELECT
USING (is_super_admin(auth.email()));