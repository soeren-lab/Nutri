ALTER TABLE public.meal_plan_entries DROP CONSTRAINT IF EXISTS meal_plan_entries_target_check;

ALTER TABLE public.meal_plan_entries ADD CONSTRAINT meal_plan_entries_target_check
CHECK (
  (food_type = 'recipe' AND recipe_id IS NOT NULL AND ingredient_master_id IS NULL)
  OR
  (food_type = 'ingredient' AND ingredient_master_id IS NOT NULL AND recipe_id IS NULL)
  OR
  (food_type = 'quick_entry' AND recipe_id IS NULL AND ingredient_master_id IS NULL AND quick_entry_name IS NOT NULL)
);