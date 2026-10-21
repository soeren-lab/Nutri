ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imported_version integer,
  ADD COLUMN IF NOT EXISTS dismissed_version integer;

CREATE INDEX IF NOT EXISTS recipes_is_published_idx ON public.recipes (is_published) WHERE is_published;
CREATE INDEX IF NOT EXISTS recipes_source_recipe_id_idx ON public.recipes (source_recipe_id);

CREATE OR REPLACE FUNCTION public.can_view_recipe(_recipe_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = _recipe_id AND (r.user_id = _user_id OR r.is_published))
      OR EXISTS (
        SELECT 1 FROM public.cookbook_recipes cr
        WHERE cr.recipe_id = _recipe_id
          AND public.can_view_cookbook(cr.cookbook_id, _user_id)
      )
$function$;