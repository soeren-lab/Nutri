import type {
  IngredientWithMaster,
  RecipeComponentWithRelations,
  RecipeNode,
} from "@/types/recipe";
import type { IngredientMaster } from "@/lib/ingredients-master";
import { resolveIngredient } from "@/lib/resolveIngredient";
import { computeNutritionFromMaster } from "@/lib/unitConversion";
import { isGroupIngredient, mastersInGroup } from "@/lib/productGroups";
import { isChoiceComponent, sortedVariants } from "@/lib/variants";
import { freeIngredients, nutritionPerServing, type RecipeLikeNode } from "@/lib/componentNutrition";

/** Kalorien-Spanne (pro Portion) eines Rezepts. */
export interface CalorieRange {
  min: number | null;
  max: number | null;
  /** true, wenn min und max unterschiedlich sind (Varianten/Sorten vorhanden). */
  isRange: boolean;
}

interface MinMax {
  min: number;
  max: number;
}

const ZERO: MinMax = { min: 0, max: 0 };

function add(a: MinMax, b: MinMax): MinMax {
  return { min: a.min + b.min, max: a.max + b.max };
}

function scale(a: MinMax, factor: number): MinMax {
  return { min: a.min * factor, max: a.max * factor };
}

function positiveServings(v: number | null | undefined): number {
  return v != null && v > 0 ? v : 1;
}

/** Kalorien einer Gruppen-Zutat für eine konkrete Sorte. */
function caloriesForMaster(
  ing: IngredientWithMaster,
  master: IngredientMaster,
): number | null {
  const c = computeNutritionFromMaster(master, ing.amount, ing.unit);
  return c.convertible ? c.calories : null;
}

/** Kalorien-Spanne einer Zutatenliste – flexible Zutaten über alle Sorten. */
function ingredientsRange(
  rows: IngredientWithMaster[],
  masters: IngredientMaster[],
): MinMax {
  let out = ZERO;
  for (const ing of rows) {
    if (isGroupIngredient(ing)) {
      const group = ing.product_group?.trim() ?? "";
      const values = mastersInGroup(masters, group)
        .map((m) => caloriesForMaster(ing, m))
        .filter((v): v is number => v != null);
      if (values.length > 0) {
        out = add(out, { min: Math.min(...values), max: Math.max(...values) });
        continue;
      }
      // Keine Sorten bekannt: nur die im Rezept gespeicherte Standard-Sorte.
      const fallback = ing.master ? caloriesForMaster(ing, ing.master) : ing.calories;
      out = add(out, { min: fallback ?? 0, max: fallback ?? 0 });
      continue;
    }
    const kcal = resolveIngredient(ing).calories ?? 0;
    out = add(out, { min: kcal, max: kcal });
  }
  return out;
}

/** Kalorien-Spanne einer Komponente für EINE Portion dieser Komponente. */
function componentRange(
  component: RecipeComponentWithRelations,
  masters: IngredientMaster[],
  depth: number,
): MinMax {
  if (component.linked_recipe_id && component.linked) {
    if (depth > 6) return ZERO;
    return nodeRange(component.linked, masters, depth + 1);
  }
  const rows = component.ingredients ?? [];
  const servings = positiveServings(component.servings);
  if (!isChoiceComponent(component)) {
    return scale(ingredientsRange(rows.filter((i) => !i.variant_id), masters), 1 / servings);
  }
  const variants = sortedVariants(component);
  if (variants.length === 0) return ZERO;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of variants) {
    const r = ingredientsRange(
      rows.filter((i) => i.variant_id === v.id),
      masters,
    );
    min = Math.min(min, r.min);
    max = Math.max(max, r.max);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return ZERO;
  return scale({ min, max }, 1 / servings);
}

/** Kalorien-Spanne eines Rezepts pro Portion – rekursiv über Komponenten. */
function nodeRange(node: RecipeNode, masters: IngredientMaster[], depth: number): MinMax {
  if (depth > 6) return ZERO;
  const free = ingredientsRange(freeIngredients({ ingredients: node.ingredients ?? [] }), masters);
  let out = scale(free, 1 / positiveServings(node.servings));
  for (const c of node.components ?? []) {
    out = add(out, componentRange(c, masters, depth));
  }
  return out;
}

function round(v: number): number {
  return Math.round(v);
}

/**
 * Kalorien pro Portion als Spanne: min = jeweils günstigste Variante/Sorte,
 * max = jeweils teuerste. Ohne Varianten/flexible Zutaten sind beide gleich.
 */
export function recipeCalorieRange(
  recipe: (RecipeLikeNode & { id?: string }) | null | undefined,
  masters: IngredientMaster[],
): CalorieRange {
  if (!recipe) return { min: null, max: null, isRange: false };
  const components = recipe.components ?? [];
  const single = nutritionPerServing(recipe).calories;
  if (components.length === 0) {
    const v = single != null ? round(single) : null;
    return { min: v, max: v, isRange: false };
  }
  const r = nodeRange(
    { ...(recipe as unknown as RecipeNode), ingredients: recipe.ingredients ?? [], components },
    masters,
    0,
  );
  const min = round(r.min);
  const max = round(r.max);
  if (min <= 0 && max <= 0) {
    const v = single != null ? round(single) : null;
    return { min: v, max: v, isRange: false };
  }
  return { min, max, isRange: max > min };
}

/** Anzeige-Text: "400 kcal" bzw. "400–800 kcal". */
export function formatCalorieRange(range: CalorieRange): string | null {
  if (range.min == null || range.max == null) return null;
  return range.isRange ? `${range.min}–${range.max} kcal` : `${range.max} kcal`;
}
