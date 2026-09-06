ALTER TABLE public.meal_plan_entries
  ADD COLUMN IF NOT EXISTS snapshot_variant_label text,
  ADD COLUMN IF NOT EXISTS snapshot_ingredients jsonb;