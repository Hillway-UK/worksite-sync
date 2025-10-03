-- Secure the notification_log table to prevent unauthorized access
-- This ensures only managers and workers can view their relevant notification logs

-- First, ensure RLS is enabled
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them with explicit security
DROP POLICY IF EXISTS "Managers can view org notifications" ON public.notification_log;
DROP POLICY IF EXISTS "Workers can view own notifications" ON public.notification_log;
DROP POLICY IF EXISTS "Service role can manage notifications" ON public.notification_log;

-- Policy 1: Workers can ONLY view their own notification logs
CREATE POLICY "Workers can view own notification logs"
ON public.notification_log
FOR SELECT
TO authenticated
USING (
  worker_id IN (
    SELECT id FROM public.workers 
    WHERE email = auth.email()
  )
);

-- Policy 2: Managers can view notification logs for workers in their organization
CREATE POLICY "Managers can view organization notification logs"
ON public.notification_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.workers w
    JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = notification_log.worker_id
    AND m.email = auth.email()
  )
);

-- Policy 3: Service role can manage all notifications (for automated systems)
CREATE POLICY "Service role full access for notifications"
ON public.notification_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 4: Allow authenticated managers to INSERT notifications for their organization's workers
CREATE POLICY "Managers can create organization notifications"
ON public.notification_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workers w
    JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = notification_log.worker_id
    AND m.email = auth.email()
  )
);

-- Policy 5: Allow service role to INSERT (for automated notification systems)
CREATE POLICY "Service role can insert notifications"
ON public.notification_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.notification_log IS 'Stores notification delivery logs. Protected by RLS - workers see only their own logs, managers see their organization logs.';