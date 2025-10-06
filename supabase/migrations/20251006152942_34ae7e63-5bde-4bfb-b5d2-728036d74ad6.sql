-- Add triggers to keep subscription_usage active counts in sync
-- Managers: increment on insert, decrement on delete
DROP TRIGGER IF EXISTS trg_increment_active_managers ON public.managers;
CREATE TRIGGER trg_increment_active_managers
AFTER INSERT ON public.managers
FOR EACH ROW
EXECUTE FUNCTION public.increment_active_managers();

DROP TRIGGER IF EXISTS trg_decrement_active_managers ON public.managers;
CREATE TRIGGER trg_decrement_active_managers
AFTER DELETE ON public.managers
FOR EACH ROW
EXECUTE FUNCTION public.decrement_active_managers();

-- Workers: increment on insert, decrement on delete
DROP TRIGGER IF EXISTS trg_increment_active_workers ON public.workers;
CREATE TRIGGER trg_increment_active_workers
AFTER INSERT ON public.workers
FOR EACH ROW
EXECUTE FUNCTION public.increment_active_workers();

DROP TRIGGER IF EXISTS trg_decrement_active_workers ON public.workers;
CREATE TRIGGER trg_decrement_active_workers
AFTER DELETE ON public.workers
FOR EACH ROW
EXECUTE FUNCTION public.decrement_active_workers();