-- First, drop the triggers explicitly
DROP TRIGGER IF EXISTS enforce_manager_limit_bi ON managers;
DROP TRIGGER IF EXISTS enforce_worker_limit_bi ON workers;

-- Now drop the functions with CASCADE to handle any remaining dependencies
DROP FUNCTION IF EXISTS tg_enforce_manager_limit() CASCADE;
DROP FUNCTION IF EXISTS tg_enforce_worker_limit() CASCADE;
DROP FUNCTION IF EXISTS assert_org_capacity(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS _active_count_for_org(regclass, uuid) CASCADE;
DROP FUNCTION IF EXISTS _col_exists(regclass, text) CASCADE;
DROP FUNCTION IF EXISTS get_org_seat_summary(uuid) CASCADE;

-- Note: We now use subscription_usage.planned_number_of_managers/workers
-- with frontend capacity checks and database triggers for counter updates