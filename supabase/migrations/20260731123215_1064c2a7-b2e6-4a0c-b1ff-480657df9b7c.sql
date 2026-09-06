CREATE TABLE public.recipe_components (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name text NOT NULL,
  servings numeric,
  sort_order integer NOT NULL DEFAULT 0,
  linked_recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_components TO authenticated;
GRANT ALL ON public.recipe_components TO service_role;

ALTER TABLE public.recipe_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read recipe_components" ON public.recipe_components
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "owner write recipe_components" ON public.recipe_components
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_components.recipe_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_components.recipe_id AND r.user_id = auth.uid()));

CREATE TRIGGER update_recipe_components_updated_at
  BEFORE UPDATE ON public.recipe_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_recipe_components_recipe_id ON public.recipe_components(recipe_id);
CREATE INDEX idx_recipe_components_linked_recipe_id ON public.recipe_components(linked_recipe_id);

ALTER TABLE public.ingredients
  ADD COLUMN component_id uuid REFERENCES public.recipe_components(id) ON DELETE CASCADE;

CREATE INDEX idx_ingredients_component_id ON public.ingredients(component_id);

ALTER TABLE public.recipes
  ADD COLUMN is_component_only boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.recipe_link_creates_cycle(_parent_recipe_id uuid, _target_recipe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE reachable AS (
    SELECT _target_recipe_id AS recipe_id
    UNION
    SELECT rc.linked_recipe_id
    FROM public.recipe_components rc
    JOIN reachable rr ON rc.recipe_id = rr.recipe_id
    WHERE rc.linked_recipe_id IS NOT NULL
  )
  SELECT EXISTS (SELECT 1 FROM reachable WHERE recipe_id = _parent_recipe_id)
$$;
