-- Fix RLS infinite recursion for managers by removing self-referential checks
-- 1) Replace the super admin policy to avoid calling a function that queries managers
DROP POLICY IF EXISTS "Super admins can manage all managers" ON public.managers;

CREATE POLICY "Super admins can manage all managers"
ON public.managers
FOR ALL
USING (public.is_super_admin(auth.email()))
WITH CHECK (public.is_super_admin(auth.email()));

-- 2) Ensure upsert works reliably by enforcing unique email on managers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'managers_email_unique'
  ) THEN
    ALTER TABLE public.managers
    ADD CONSTRAINT managers_email_unique UNIQUE (email);
  END IF;
END $$;