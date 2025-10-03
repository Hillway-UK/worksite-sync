-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Super admins can view org usage" ON subscription_usage;

-- Create separate policies for better control
-- Super admins can insert subscription usage for any organization
CREATE POLICY "Super admins can create subscription usage"
ON subscription_usage
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM super_admins
    WHERE super_admins.email = auth.email()
  )
);

-- Super admins can view subscription usage for their organization
CREATE POLICY "Super admins can view org usage"
ON subscription_usage
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT super_admins.organization_id
    FROM super_admins
    WHERE super_admins.email = auth.email()
  )
);

-- Super admins can update subscription usage for their organization
CREATE POLICY "Super admins can update org usage"
ON subscription_usage
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT super_admins.organization_id
    FROM super_admins
    WHERE super_admins.email = auth.email()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT super_admins.organization_id
    FROM super_admins
    WHERE super_admins.email = auth.email()
  )
);

-- Super admins can delete subscription usage for their organization
CREATE POLICY "Super admins can delete org usage"
ON subscription_usage
FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT super_admins.organization_id
    FROM super_admins
    WHERE super_admins.email = auth.email()
  )
);