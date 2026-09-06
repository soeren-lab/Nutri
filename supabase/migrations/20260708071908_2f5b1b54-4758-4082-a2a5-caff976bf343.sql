ALTER TABLE public.ingredients_master
  ADD COLUMN IF NOT EXISTS density_g_per_ml numeric;