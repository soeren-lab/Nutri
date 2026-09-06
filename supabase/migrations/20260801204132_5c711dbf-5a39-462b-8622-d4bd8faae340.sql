ALTER TABLE public.ingredients_master
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_ingredient_id uuid REFERENCES public.ingredients_master(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imported_version integer,
  ADD COLUMN IF NOT EXISTS dismissed_version integer;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ingredients_master_published_idx ON public.ingredients_master (is_published) WHERE is_published;
CREATE INDEX IF NOT EXISTS ingredients_master_source_idx ON public.ingredients_master (source_ingredient_id);

DROP POLICY IF EXISTS "read published ingredients_master" ON public.ingredients_master;
CREATE POLICY "read published ingredients_master"
  ON public.ingredients_master FOR SELECT TO authenticated
  USING (is_published = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "read published brands" ON public.brands;
CREATE POLICY "read published brands"
  ON public.brands FOR SELECT TO authenticated
  USING (is_published = true OR auth.uid() = user_id);