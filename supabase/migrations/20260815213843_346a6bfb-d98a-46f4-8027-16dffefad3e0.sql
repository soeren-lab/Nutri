ALTER TABLE public.meal_plan_entries
  ADD COLUMN IF NOT EXISTS snapshot_name text,
  ADD COLUMN IF NOT EXISTS snapshot_calories numeric,
  ADD COLUMN IF NOT EXISTS snapshot_protein_g numeric,
  ADD COLUMN IF NOT EXISTS snapshot_carbs_g numeric,
  ADD COLUMN IF NOT EXISTS snapshot_fat_g numeric;

-- Schnelleinträge: Werte liegen bereits im Eintrag
UPDATE public.meal_plan_entries
SET snapshot_name = COALESCE(snapshot_name, quick_entry_name, 'Schnelleintrag'),
    snapshot_calories = COALESCE(snapshot_calories, quick_entry_calories),
    snapshot_protein_g = COALESCE(snapshot_protein_g, quick_entry_protein_g),
    snapshot_carbs_g = COALESCE(snapshot_carbs_g, quick_entry_carbs_g),
    snapshot_fat_g = COALESCE(snapshot_fat_g, quick_entry_fat_g)
WHERE food_type = 'quick_entry';

-- Rezepte: einfache Nährwerte pro Portion * geplante Portionen
UPDATE public.meal_plan_entries e
SET snapshot_name = COALESCE(e.snapshot_name, r.title),
    snapshot_calories = COALESCE(e.snapshot_calories, r.calories * COALESCE(e.servings, r.servings, 1)),
    snapshot_protein_g = COALESCE(e.snapshot_protein_g, r.protein_g * COALESCE(e.servings, r.servings, 1)),
    snapshot_carbs_g = COALESCE(e.snapshot_carbs_g, r.carbs_g * COALESCE(e.servings, r.servings, 1)),
    snapshot_fat_g = COALESCE(e.snapshot_fat_g, r.fat_g * COALESCE(e.servings, r.servings, 1))
FROM public.recipes r
WHERE e.recipe_id = r.id AND e.food_type = 'recipe';

-- Lebensmittel: nur bei gleicher bzw. leerer Einheit eindeutig berechenbar
UPDATE public.meal_plan_entries e
SET snapshot_name = COALESCE(e.snapshot_name, m.name),
    snapshot_calories = COALESCE(e.snapshot_calories, m.calories * (CASE WHEN m.unit IN ('g','ml') THEN e.amount / 100.0 ELSE e.amount END)),
    snapshot_protein_g = COALESCE(e.snapshot_protein_g, m.protein_g * (CASE WHEN m.unit IN ('g','ml') THEN e.amount / 100.0 ELSE e.amount END)),
    snapshot_carbs_g = COALESCE(e.snapshot_carbs_g, m.carbs_g * (CASE WHEN m.unit IN ('g','ml') THEN e.amount / 100.0 ELSE e.amount END)),
    snapshot_fat_g = COALESCE(e.snapshot_fat_g, m.fat_g * (CASE WHEN m.unit IN ('g','ml') THEN e.amount / 100.0 ELSE e.amount END))
FROM public.ingredients_master m
WHERE e.ingredient_master_id = m.id
  AND e.food_type = 'ingredient'
  AND e.amount IS NOT NULL
  AND (e.unit IS NULL OR e.unit = m.unit);

-- Restliche Namen nachziehen
UPDATE public.meal_plan_entries e
SET snapshot_name = m.name
FROM public.ingredients_master m
WHERE e.ingredient_master_id = m.id AND e.snapshot_name IS NULL;