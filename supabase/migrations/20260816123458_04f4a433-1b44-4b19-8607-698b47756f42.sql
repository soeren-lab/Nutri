UPDATE public.ingredients i
SET product_group = m.subcategory
FROM public.ingredients_master m, public.recipe_components c
WHERE m.id = i.ingredient_master_id
  AND c.id = i.component_id
  AND c.component_type = 'choice'
  AND m.subcategory IS NOT NULL
  AND i.product_group IS NULL;