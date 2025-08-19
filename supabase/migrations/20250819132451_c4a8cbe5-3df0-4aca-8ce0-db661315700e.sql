-- Fix remaining function security issues by setting search_path for all existing functions
-- These functions were already in the database but missing security settings

CREATE OR REPLACE FUNCTION public.is_manager(user_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = user_email
  );
$function$;

CREATE OR REPLACE FUNCTION public.check_is_manager(user_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = user_email
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE email = user_email
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_user_organization_id(user_email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(
    (SELECT organization_id FROM public.super_admins WHERE email = user_email),
    (SELECT organization_id FROM public.managers WHERE email = user_email),
    (SELECT organization_id FROM public.workers WHERE email = user_email)
  );
$function$;

CREATE OR REPLACE FUNCTION public.auto_clock_out_after_12_hours()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.clock_entries
  SET 
    clock_out = clock_in + INTERVAL '12 hours',
    auto_clocked_out = true,
    notes = COALESCE(notes || ' | ', '') || 'Auto clocked-out after 12 hours'
  WHERE 
    clock_out IS NULL
    AND clock_in < NOW() - INTERVAL '12 hours';
END;
$function$;