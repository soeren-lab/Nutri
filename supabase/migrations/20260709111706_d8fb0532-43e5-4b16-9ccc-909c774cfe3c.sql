
-- Brands table
CREATE TABLE public.brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brands" ON public.brands
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add brand_id FK to ingredients_master
ALTER TABLE public.ingredients_master
  ADD COLUMN brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX idx_ingredients_master_brand_id ON public.ingredients_master(brand_id);

-- Backfill: existing brand strings → brands table + brand_id
INSERT INTO public.brands (user_id, name)
SELECT DISTINCT user_id, TRIM(brand)
FROM public.ingredients_master
WHERE brand IS NOT NULL AND TRIM(brand) <> ''
ON CONFLICT (user_id, name) DO NOTHING;

UPDATE public.ingredients_master im
SET brand_id = b.id
FROM public.brands b
WHERE b.user_id = im.user_id
  AND im.brand IS NOT NULL
  AND TRIM(im.brand) = b.name;

-- Drop legacy brand string column
ALTER TABLE public.ingredients_master DROP COLUMN brand;
