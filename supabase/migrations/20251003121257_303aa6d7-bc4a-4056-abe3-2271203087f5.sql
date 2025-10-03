-- Fix search_path security warnings for capacity enforcement functions

ALTER FUNCTION public._col_exists(regclass, text) 
SET search_path = public;

ALTER FUNCTION public._active_count_for_org(regclass, uuid) 
SET search_path = public;

ALTER FUNCTION public.assert_org_capacity(uuid, text) 
SET search_path = public;

ALTER FUNCTION public.tg_enforce_manager_limit() 
SET search_path = public;

ALTER FUNCTION public.tg_enforce_worker_limit() 
SET search_path = public;

ALTER FUNCTION public.get_org_seat_summary(uuid) 
SET search_path = public;