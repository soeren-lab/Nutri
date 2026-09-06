ALTER TABLE public.meal_plan_entries
  ADD COLUMN IF NOT EXISTS skipped boolean NOT NULL DEFAULT false;
