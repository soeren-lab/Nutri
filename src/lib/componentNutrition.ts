import type {
  IngredientWithMaster,
  RecipeComponentWithRelations,
  RecipeNode,
} from "@/types/recipe";
import { resolveIngredients } from "@/lib/resolveIngredient";
import { effectiveComponentIngredients, type VariantSelection } from "@/lib/variants";
import { sumNutrition } from "@/lib/nutrition-db";

export interface NutritionTotals {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
}

export const ZERO_NUTRITION: NutritionTotals = {
  calories: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  fiber_g: null,
  sugar_g: null,
};

const KEYS = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g"] as const;

export function addNutrition(...parts: NutritionTotals[]): NutritionTotals {
  const out: NutritionTotals = { ...ZERO_NUTRITION };
  for (const key of KEYS) {
    let sum: number | null = null;
    for (const p of parts) {
      const v = p[key];
      if (v != null) sum = (sum ?? 0) + v;
    }
    out[key] = sum == null ? null : Math.round(sum * 10) / 10;
  }
  return out;
}

export function scaleNutrition(n: NutritionTotals, factor: number): NutritionTotals {
  const out: NutritionTotals = { ...ZERO_NUTRITION };
  for (const key of KEYS) {
    const v = n[key];
    out[key] = v == null ? null : Math.round(v * factor * 10) / 10;
  }
  return out;
}

export function hasAnyNutrition(n: NutritionTotals): boolean {
  return KEYS.some((k) => n[k] != null);
}

/** Zutaten eines Rezepts, die keiner Komponente zugeordnet sind. */
export function freeIngredients(node: {
  ingredients: IngredientWithMaster[];
}): IngredientWithMaster[] {
  return node.ingredients.filter((i) => !i.component_id);
}

function positiveServings(v: number | null | undefined): number {
  return v != null && v > 0 ? v : 1;
}

/**
 * Nährwerte einer Komponente für EINE Portion dieser Komponente.
 * - inline: Summe eigener Zutaten / component.servings
 * - verlinkt: Nährwerte pro Portion des verlinkten Rezepts (rekursiv)
 */
export function componentNutritionPerServing(
  component: RecipeComponentWithRelations,
  depth = 0,
  selection?: VariantSelection | null,
): NutritionTotals {
  if (component.linked_recipe_id && component.linked) {
    if (depth > 6) return ZERO_NUTRITION;
    return recipeNutritionPerServing(component.linked, depth + 1, selection);
  }
  const raw = sumNutrition(resolveIngredients(effectiveComponentIngredients(component, selection)));
  return scaleNutrition(raw, 1 / positiveServings(component.servings));
}

/**
 * Nährwerte eines Rezepts pro Portion – rekursiv über alle Komponenten.
 * Freie Zutaten werden durch recipe.servings geteilt, Komponenten mit
 * jeweils 1 Portion gezählt.
 */
export function recipeNutritionPerServing(
  node: RecipeNode,
  depth = 0,
  selection?: VariantSelection | null,
): NutritionTotals {
  if (depth > 6) return ZERO_NUTRITION;
  const free = sumNutrition(resolveIngredients(freeIngredients(node)));
  const freePer = scaleNutrition(free, 1 / positiveServings(node.servings));
  const comps = (node.components ?? []).map((c) =>
    componentNutritionPerServing(c, depth, selection),
  );
  return addNutrition(freePer, ...comps);
}

/**
 * Referenzwert für die Detailseite: Summe aller Komponenten bei jeweils
 * einer Portion, plus freie Zutaten (pro Portion des Rezepts).
 */
export function recipeReferenceTotals(
  node: RecipeNode,
  selection?: VariantSelection | null,
): NutritionTotals {
  return recipeNutritionPerServing(node, 0, selection);
}

/** Lockere Rezept-Form: Komponenten und Zutaten optional geladen. */
export type RecipeLikeNode = {
  servings?: number | null;
  nutrition_mode?: string | null;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  ingredients?: IngredientWithMaster[] | null;
  components?: RecipeComponentWithRelations[] | null;
};

/**
 * Zentrale Nährwert-Berechnung PRO PORTION für jede Anzeige (Karte, Liste,
 * Detail, PDF, Kochmodus, Planer):
 * - mit Komponenten: SUMME aller Komponenten (je 1 Portion) + freie Zutaten
 *   geteilt durch recipe.servings – niemals ein Durchschnitt.
 * - ohne Komponenten: bestehende Logik (Zutaten-Summe bzw. gespeicherte
 *   Werte) geteilt durch recipe.servings.
 */
export function nutritionPerServing(
  recipe: RecipeLikeNode | null | undefined,
  selection?: VariantSelection | null,
): NutritionTotals {
  if (!recipe) return ZERO_NUTRITION;
  const ingredients = recipe.ingredients ?? [];
  const components = recipe.components ?? [];
  if (components.length > 0) {
    return recipeNutritionPerServing(
      { ...(recipe as unknown as RecipeNode), ingredients, components },
      0,
      selection,
    );
  }
  const advanced =
    recipe.nutrition_mode === "advanced" && ingredients.length > 0
      ? sumNutrition(resolveIngredients(ingredients))
      : null;
  const base: NutritionTotals = advanced ?? {
    calories: recipe.calories != null ? Number(recipe.calories) : null,
    protein_g: recipe.protein_g != null ? Number(recipe.protein_g) : null,
    carbs_g: recipe.carbs_g != null ? Number(recipe.carbs_g) : null,
    fat_g: recipe.fat_g != null ? Number(recipe.fat_g) : null,
    fiber_g: recipe.fiber_g != null ? Number(recipe.fiber_g) : null,
    sugar_g: recipe.sugar_g != null ? Number(recipe.sugar_g) : null,
  };
  return scaleNutrition(base, 1 / positiveServings(recipe.servings));
}


/** Gesamt-Nährwerte für individuell gewählte Portionen pro Komponente. */
export function totalsForServingsMap(
  node: RecipeNode,
  servingsByComponent: Record<string, number>,
  freeServings: number,
  selection?: VariantSelection | null,
): NutritionTotals {
  const free = sumNutrition(resolveIngredients(freeIngredients(node)));
  const freePer = scaleNutrition(free, freeServings / positiveServings(node.servings));
  const comps = (node.components ?? []).map((c) =>
    scaleNutrition(
      componentNutritionPerServing(c, 0, selection),
      servingsByComponent[c.id] ?? positiveServings(c.servings),
    ),
  );
  return addNutrition(freePer, ...comps);
}
