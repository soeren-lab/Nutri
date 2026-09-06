ALTER TABLE public.recipes
  ADD COLUMN calories numeric,
  ADD COLUMN protein_g numeric,
  ADD COLUMN carbs_g numeric,
  ADD COLUMN fat_g numeric;