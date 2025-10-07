-- Add RLS policy to allow service role to manage subscription_usage
-- This is needed for the upgrade_subscription_plan function to work

CREATE POLICY "Service role can manage subscription usage"
ON public.subscription_usage
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);