-- ============================================================================
-- CRITICAL SECURITY FIX: Organization-Scoped RLS Policies
-- Prevents managers from viewing/modifying data from other organizations
-- ============================================================================

-- ============================================================================
-- 1. ADDITIONAL_COSTS: Replace "view all" with org-scoped policies
-- ============================================================================

DROP POLICY IF EXISTS "Managers can view all additional costs" ON public.additional_costs;

-- Managers can only SELECT additional_costs for workers in their organization
CREATE POLICY "Managers can view organization additional costs"
ON public.additional_costs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = additional_costs.worker_id
    AND m.email = auth.email()
  )
);

-- Managers can INSERT additional_costs only for workers in their organization
CREATE POLICY "Managers can create organization additional costs"
ON public.additional_costs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = additional_costs.worker_id
    AND m.email = auth.email()
  )
);

-- Managers can UPDATE additional_costs only for workers in their organization
CREATE POLICY "Managers can update organization additional costs"
ON public.additional_costs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = additional_costs.worker_id
    AND m.email = auth.email()
  )
);

-- Managers can DELETE additional_costs only for workers in their organization
CREATE POLICY "Managers can delete organization additional costs"
ON public.additional_costs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = additional_costs.worker_id
    AND m.email = auth.email()
  )
);

-- ============================================================================
-- 2. CLOCK_ENTRIES: Replace "view all" with org-scoped policies
-- ============================================================================

DROP POLICY IF EXISTS "Managers can view all clock entries" ON public.clock_entries;

-- Managers can only SELECT clock_entries for workers in their organization
CREATE POLICY "Managers can view organization clock entries"
ON public.clock_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = clock_entries.worker_id
    AND m.email = auth.email()
  )
);

-- Managers can UPDATE clock_entries only for workers in their organization
CREATE POLICY "Managers can update organization clock entries"
ON public.clock_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = clock_entries.worker_id
    AND m.email = auth.email()
  )
);

-- Managers can DELETE clock_entries only for workers in their organization
CREATE POLICY "Managers can delete organization clock entries"
ON public.clock_entries
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = clock_entries.worker_id
    AND m.email = auth.email()
  )
);

-- ============================================================================
-- 3. TIME_AMENDMENTS: Replace "manage all" with org-scoped policies
-- ============================================================================

DROP POLICY IF EXISTS "Managers can manage all amendments" ON public.time_amendments;

-- Managers can only SELECT amendments for workers in their organization
CREATE POLICY "Managers can view organization amendments"
ON public.time_amendments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = time_amendments.worker_id
    AND m.email = auth.email()
  )
);

-- Managers can INSERT amendments only for workers in their organization
CREATE POLICY "Managers can create organization amendments"
ON public.time_amendments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = time_amendments.worker_id
    AND m.email = auth.email()
  )
);

-- Managers can UPDATE amendments only for workers in their organization
CREATE POLICY "Managers can update organization amendments"
ON public.time_amendments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = time_amendments.worker_id
    AND m.email = auth.email()
  )
);

-- Managers can DELETE amendments only for workers in their organization
CREATE POLICY "Managers can delete organization amendments"
ON public.time_amendments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = time_amendments.worker_id
    AND m.email = auth.email()
  )
);

-- ============================================================================
-- 4. EXPENSE_TYPES: Fix update policy to be org-scoped
-- ============================================================================

DROP POLICY IF EXISTS "Managers can view all expense types" ON public.expense_types;
DROP POLICY IF EXISTS "Managers can update expense types" ON public.expense_types;

-- Managers can only SELECT expense_types created by managers in their organization
CREATE POLICY "Managers can view organization expense types"
ON public.expense_types
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.managers m1
    INNER JOIN public.managers m2 ON m1.organization_id = m2.organization_id
    WHERE m1.id = expense_types.created_by
    AND m2.email = auth.email()
  )
);

-- Managers can UPDATE expense_types only if created by someone in their organization
CREATE POLICY "Managers can update organization expense types"
ON public.expense_types
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.managers m1
    INNER JOIN public.managers m2 ON m1.organization_id = m2.organization_id
    WHERE m1.id = expense_types.created_by
    AND m2.email = auth.email()
  )
);

-- Managers can DELETE expense_types only if created by someone in their organization
CREATE POLICY "Managers can delete organization expense types"
ON public.expense_types
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.managers m1
    INNER JOIN public.managers m2 ON m1.organization_id = m2.organization_id
    WHERE m1.id = expense_types.created_by
    AND m2.email = auth.email()
  )
);

-- ============================================================================
-- 5. NOTIFICATIONS: Replace "view all" with org-scoped policies
-- ============================================================================

DROP POLICY IF EXISTS "Managers can view all notifications" ON public.notifications;

-- Managers can only SELECT notifications for workers in their organization
CREATE POLICY "Managers can view organization notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = notifications.worker_id
    AND m.email = auth.email()
  )
);

-- ============================================================================
-- 6. NOTIFICATION_PREFERENCES: Replace "view all" with org-scoped policies
-- ============================================================================

DROP POLICY IF EXISTS "Managers can view all notification preferences" ON public.notification_preferences;

-- Managers can only SELECT notification_preferences for workers in their organization
CREATE POLICY "Managers can view organization notification preferences"
ON public.notification_preferences
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    INNER JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = notification_preferences.worker_id
    AND m.email = auth.email()
  )
);