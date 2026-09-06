
CREATE TABLE public.ingredients_master (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'g',
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ingredients_master_user_name_key
  ON public.ingredients_master (user_id, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredients_master TO authenticated;
GRANT ALL ON public.ingredients_master TO service_role;

ALTER TABLE public.ingredients_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ingredients_master"
  ON public.ingredients_master
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_ingredients_master_updated_at
  BEFORE UPDATE ON public.ingredients_master
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS ingredient_master_id uuid
  REFERENCES public.ingredients_master(id) ON DELETE SET NULL;
