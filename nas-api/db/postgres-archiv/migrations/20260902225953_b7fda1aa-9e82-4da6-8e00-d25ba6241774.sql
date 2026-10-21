CREATE OR REPLACE FUNCTION public.get_my_recipe_import_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(MAX(cnt), 0)::integer
  FROM (
    SELECT COUNT(*) AS cnt
    FROM public.recipes mine
    JOIN public.recipes copies ON copies.source_recipe_id = mine.id
    WHERE auth.uid() IS NOT NULL
      AND mine.user_id = auth.uid()
      AND mine.is_published
      AND copies.user_id <> auth.uid()
    GROUP BY mine.id
  ) x
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_recipe_import_count() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_recipe_import_count() TO authenticated;