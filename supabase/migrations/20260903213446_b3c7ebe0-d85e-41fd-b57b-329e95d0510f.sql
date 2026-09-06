ALTER TABLE public.ingredients_master
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_barcode text;