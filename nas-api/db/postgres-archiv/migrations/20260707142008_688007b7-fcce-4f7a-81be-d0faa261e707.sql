ALTER TABLE public.ingredients
  ADD COLUMN calories numeric,
  ADD COLUMN protein_g numeric,
  ADD COLUMN carbs_g numeric,
  ADD COLUMN fat_g numeric;

ALTER TABLE public.recipes
  ADD COLUMN nutrition_mode text NOT NULL DEFAULT 'simple';

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_nutrition_mode_check
  CHECK (nutrition_mode IN ('simple', 'advanced'));