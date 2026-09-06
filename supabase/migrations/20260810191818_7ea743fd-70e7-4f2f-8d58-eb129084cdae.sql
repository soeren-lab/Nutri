ALTER TABLE public.meal_plan_entries DROP CONSTRAINT IF EXISTS meal_plan_entries_unique_slot;

ALTER TABLE public.meal_plan_entries
  ALTER COLUMN recipe_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS food_type text NOT NULL DEFAULT 'recipe',
  ADD COLUMN IF NOT EXISTS ingredient_master_id uuid REFERENCES public.ingredients_master(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_food_type_check
  CHECK (food_type IN ('recipe','ingredient'));

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_target_check
  CHECK (
    (food_type = 'recipe' AND recipe_id IS NOT NULL AND ingredient_master_id IS NULL)
    OR (food_type = 'ingredient' AND ingredient_master_id IS NOT NULL AND recipe_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS meal_plan_entries_user_date_idx
  ON public.meal_plan_entries (user_id, date);