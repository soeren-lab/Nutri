ALTER TABLE public.ingredients_master ADD COLUMN IF NOT EXISTS sugar_g numeric;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS sugar_g numeric;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS sugar_g numeric;
ALTER TABLE public.meal_plan_entries ADD COLUMN IF NOT EXISTS snapshot_sugar_g numeric;
ALTER TABLE public.meal_plan_entries ADD COLUMN IF NOT EXISTS quick_entry_sugar_g numeric;
ALTER TABLE public.quick_entry_templates ADD COLUMN IF NOT EXISTS sugar_g numeric;
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS target_sugar_max_g numeric;
ALTER TABLE public.target_history ADD COLUMN IF NOT EXISTS target_sugar_max_g numeric;