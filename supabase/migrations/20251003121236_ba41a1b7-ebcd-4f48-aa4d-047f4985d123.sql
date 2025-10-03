-- Helper function to check if a column exists
CREATE OR REPLACE FUNCTION public._col_exists(p_table regclass, p_col text)
RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = p_table AND attname = p_col AND NOT attisdropped
  );
$$;

-- Count active records for an organization
CREATE OR REPLACE FUNCTION public._active_count_for_org(p_table regclass, p_org uuid)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  v_sql text;
  v_count bigint;
  has_is_active boolean := public._col_exists(p_table, 'is_active');
BEGIN
  IF has_is_active THEN
    v_sql := format('SELECT count(*) FROM %s WHERE organization_id = $1 AND is_active = true', p_table);
  ELSE
    v_sql := format('SELECT count(*) FROM %s WHERE organization_id = $1', p_table);
  END IF;
  
  EXECUTE v_sql USING p_org INTO v_count;
  RETURN v_count;
END;
$$;

-- Main capacity assertion function
CREATE OR REPLACE FUNCTION public.assert_org_capacity(p_org uuid, p_kind text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_limit int;
  v_count bigint;
BEGIN
  IF p_kind NOT IN ('manager','worker') THEN
    RAISE EXCEPTION 'Invalid kind: % (use manager or worker)', p_kind;
  END IF;

  -- Fetch limit from organizations table
  IF p_kind = 'manager' THEN
    SELECT max_managers INTO v_limit FROM public.organizations WHERE id = p_org;
    v_count := public._active_count_for_org('public.managers'::regclass, p_org);
  ELSE
    SELECT max_workers INTO v_limit FROM public.organizations WHERE id = p_org;
    v_count := public._active_count_for_org('public.workers'::regclass, p_org);
  END IF;

  -- NULL limit = unlimited
  IF v_limit IS NULL THEN RETURN; END IF;

  -- Check capacity
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Plan limit reached: This organization already has % % (limit %). You need to upgrade the plan or free a seat.',
      v_count, 
      CASE WHEN p_kind = 'manager' THEN 'managers' ELSE 'workers' END,
      v_limit
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- Trigger function for managers
CREATE OR REPLACE FUNCTION public.tg_enforce_manager_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.assert_org_capacity(NEW.organization_id, 'manager');
  RETURN NEW;
END;
$$;

-- Trigger function for workers
CREATE OR REPLACE FUNCTION public.tg_enforce_worker_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.assert_org_capacity(NEW.organization_id, 'worker');
  RETURN NEW;
END;
$$;

-- Create triggers if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_manager_limit_bi') THEN
    CREATE TRIGGER enforce_manager_limit_bi
    BEFORE INSERT ON public.managers
    FOR EACH ROW EXECUTE PROCEDURE public.tg_enforce_manager_limit();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_worker_limit_bi') THEN
    CREATE TRIGGER enforce_worker_limit_bi
    BEFORE INSERT ON public.workers
    FOR EACH ROW EXECUTE PROCEDURE public.tg_enforce_worker_limit();
  END IF;
END$$;

-- Optional: Seat summary RPC for UI
CREATE OR REPLACE FUNCTION public.get_org_seat_summary(p_org uuid)
RETURNS TABLE(kind text, used int, seat_limit int, remaining int)
LANGUAGE plpgsql AS $$
DECLARE
  m_used int := public._active_count_for_org('public.managers'::regclass, p_org);
  w_used int := public._active_count_for_org('public.workers'::regclass, p_org);
  m_limit int;
  w_limit int;
BEGIN
  SELECT max_managers, max_workers INTO m_limit, w_limit
  FROM public.organizations WHERE id = p_org;

  RETURN QUERY SELECT 'manager'::text, m_used, m_limit, 
    CASE WHEN m_limit IS NULL THEN NULL ELSE GREATEST(m_limit - m_used, 0) END;
  RETURN QUERY SELECT 'worker'::text, w_used, w_limit,
    CASE WHEN w_limit IS NULL THEN NULL ELSE GREATEST(w_limit - w_used, 0) END;
END;
$$;