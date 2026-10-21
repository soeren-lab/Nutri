ALTER TABLE public.meal_plan_entries
  ADD COLUMN IF NOT EXISTS days_late integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.set_meal_plan_days_late()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.days_late := GREATEST(0, (COALESCE(NEW.created_at, now())::date - NEW.date));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meal_plan_entries_days_late ON public.meal_plan_entries;
CREATE TRIGGER trg_meal_plan_entries_days_late
BEFORE INSERT ON public.meal_plan_entries
FOR EACH ROW EXECUTE FUNCTION public.set_meal_plan_days_late();

UPDATE public.meal_plan_entries
SET days_late = GREATEST(0, (created_at::date - date))
WHERE days_late = 0 AND created_at::date > date;

ALTER TABLE public.points_log
  ADD COLUMN IF NOT EXISTS days_late integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_multiplier_applied numeric NOT NULL DEFAULT 1;