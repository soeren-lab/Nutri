CREATE OR REPLACE FUNCTION public.can_view_recipe(_recipe_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = _recipe_id AND r.user_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.cookbook_recipes cr
        WHERE cr.recipe_id = _recipe_id
          AND public.can_view_cookbook(cr.cookbook_id, _user_id)
      )
$$;

DROP POLICY IF EXISTS "auth read recipes" ON public.recipes;
CREATE POLICY "view own or shared recipes" ON public.recipes
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_view_recipe(id, auth.uid()));

DROP POLICY IF EXISTS "auth read steps" ON public.steps;
CREATE POLICY "view steps of viewable recipes" ON public.steps
FOR SELECT TO authenticated
USING (public.can_view_recipe(recipe_id, auth.uid()));

DROP POLICY IF EXISTS "auth read ingredients" ON public.ingredients;
CREATE POLICY "view ingredients of viewable recipes" ON public.ingredients
FOR SELECT TO authenticated
USING (public.can_view_recipe(recipe_id, auth.uid()));

DROP POLICY IF EXISTS "auth read recipe_components" ON public.recipe_components;
CREATE POLICY "view components of viewable recipes" ON public.recipe_components
FOR SELECT TO authenticated
USING (public.can_view_recipe(recipe_id, auth.uid()));

DROP POLICY IF EXISTS "auth read component_variants" ON public.component_variants;
CREATE POLICY "view variants of viewable recipes" ON public.component_variants
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.recipe_components rc
  WHERE rc.id = component_variants.component_id
    AND public.can_view_recipe(rc.recipe_id, auth.uid())
));