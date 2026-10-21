ALTER TABLE public.recipe_components
  ADD COLUMN IF NOT EXISTS component_type text NOT NULL DEFAULT 'fixed';

ALTER TABLE public.recipe_components
  DROP CONSTRAINT IF EXISTS recipe_components_component_type_check;
ALTER TABLE public.recipe_components
  ADD CONSTRAINT recipe_components_component_type_check
  CHECK (component_type IN ('fixed', 'choice'));

CREATE TABLE IF NOT EXISTS public.component_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES public.recipe_components(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.component_variants TO authenticated;
GRANT ALL ON public.component_variants TO service_role;

ALTER TABLE public.component_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read component_variants"
  ON public.component_variants FOR SELECT TO authenticated USING (true);

CREATE POLICY "owner write component_variants"
  ON public.component_variants FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recipe_components rc
    JOIN public.recipes r ON r.id = rc.recipe_id
    WHERE rc.id = component_variants.component_id AND r.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recipe_components rc
    JOIN public.recipes r ON r.id = rc.recipe_id
    WHERE rc.id = component_variants.component_id AND r.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS component_variants_component_id_idx
  ON public.component_variants(component_id);

ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.component_variants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ingredients_variant_id_idx ON public.ingredients(variant_id);

ALTER TABLE public.meal_plan_entries
  ADD COLUMN IF NOT EXISTS selected_variant_ids jsonb;