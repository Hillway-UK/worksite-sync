-- Drop the overly permissive notification insert policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create a secure policy for managers to insert notifications for their organization's workers
CREATE POLICY "Managers can create notifications for organization workers"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workers w
    JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = notifications.worker_id
    AND m.email = auth.email()
  )
);

-- Create a policy for service role to insert notifications (for automated system processes)
CREATE POLICY "Service role can create notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);