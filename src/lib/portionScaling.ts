import type { RecipeComponentWithRelations } from "@/types/recipe";
import { freeIngredients } from "@/lib/componentNutrition";
import { effectiveComponentIngredients, type VariantSelection } from "@/lib/variants";

export function positiveServings(v: number | null | undefined): number {
  return v != null && Number(v) > 0 ? Number(v) : 1;
}

/** Zutaten einer Komponente (inline oder aus dem verlinkten Rezept). */
export function componentIngredients(
  c: RecipeComponentWithRelations,
  selection: VariantSelection,
) {
  if (c.linked_recipe_id && c.linked) return freeIngredients(c.linked);
  return effectiveComponentIngredients(c, selection);
}

/**
 * Portionsbasis einer Komponente: eigene Angabe, sonst die des verlinkten
 * Rezepts, sonst 1. So skaliert eine Beilage mit Basis „1 Portion" mit dem
 * vollen Batch-Faktor, während Komponenten mit eigener Basis anteilig skalieren.
 */
export function componentBaseServings(c: RecipeComponentWithRelations): number {
  if (c.servings != null && c.servings > 0) return c.servings;
  if (c.linked_recipe_id && c.linked) return positiveServings(c.linked.servings);
  return 1;
}

/** Skalierungsfaktor einer Komponente für die gewünschte Portionszahl. */
export function componentScaleFactor(
  c: RecipeComponentWithRelations,
  targetServings: number,
): number {
  return targetServings / componentBaseServings(c);
}
