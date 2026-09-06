ALTER TABLE public.meal_plan_entries
  ADD COLUMN IF NOT EXISTS input_mode text NOT NULL DEFAULT 'servings',
  ADD COLUMN IF NOT EXISTS input_grams_value numeric;

ALTER TABLE public.meal_plan_entries
  DROP CONSTRAINT IF EXISTS meal_plan_entries_input_mode_check;
ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_input_mode_check CHECK (input_mode IN ('servings','grams'));