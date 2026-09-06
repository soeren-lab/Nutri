import type {
  IngredientWithMaster,
  RecipeComponentWithRelations,
  RecipeNode,
} from "@/types/recipe";
import { freeIngredients } from "@/lib/componentNutrition";
import { effectiveComponentIngredients, type VariantSelection } from "@/lib/variants";
import { convert } from "@/lib/unitConversion";

export type WeightSummary = {
  /** Summe aller umrechenbaren Zutaten in Gramm. */
  grams: number;
  /** Zutaten, die nicht in Gramm umgerechnet werden konnten (z.B. „Stück"). */
  skipped: number;
};

const EMPTY: WeightSummary = { grams: 0, skipped: 0 };

function addWeight(...parts: WeightSummary[]): WeightSummary {
  return parts.reduce(
    (acc, p) => ({ grams: acc.grams + p.grams, skipped: acc.skipped + p.skipped }),
    EMPTY,
  );
}

function scaleWeight(w: WeightSummary, factor: number): WeightSummary {
  return { grams: w.grams * factor, skipped: w.skipped };
}

function positiveServings(v: number | null | undefined): number {
  return v != null && v > 0 ? v : 1;
}

/** Gewicht einer einzelnen Zutat in Gramm (via Dichte-Konvertierung). */
function ingredientWeight(ing: IngredientWithMaster): WeightSummary {
  if (ing.amount == null || ing.amount <= 0) return EMPTY;
  const unit = ing.unit ?? ing.master?.unit ?? "g";
  const density = ing.master?.density_g_per_ml ?? 1;
  const grams = convert(Number(ing.amount), unit, "g", density);
  if (grams == null) return { grams: 0, skipped: 1 };
  return { grams, skipped: 0 };
}

function sumWeights(rows: IngredientWithMaster[]): WeightSummary {
  return addWeight(...rows.map(ingredientWeight));
}

/** Gewicht einer Komponente für EINE Portion dieser Komponente. */
function componentWeightPerServing(
  component: RecipeComponentWithRelations,
  depth: number,
  selection?: VariantSelection | null,
): WeightSummary {
  if (component.linked_recipe_id && component.linked) {
    if (depth > 6) return EMPTY;
    return recipeWeightPerServing(component.linked, depth + 1, selection);
  }
  return scaleWeight(
    sumWeights(effectiveComponentIngredients(component, selection)),
    1 / positiveServings(component.servings),
  );
}

/**
 * Gesamtgewicht eines Rezepts pro Portion in Gramm – rekursiv über alle
 * Komponenten, inkl. gewählter Variante/Sorte.
 */
export function recipeWeightPerServing(
  node: RecipeNode,
  depth = 0,
  selection?: VariantSelection | null,
): WeightSummary {
  if (depth > 6) return EMPTY;
  const free = scaleWeight(sumWeights(freeIngredients(node)), 1 / positiveServings(node.servings));
  const comps = (node.components ?? []).map((c) => componentWeightPerServing(c, depth, selection));
  return addWeight(free, ...comps);
}

/** Lockere Rezept-Form (Komponenten/Zutaten optional geladen). */
export type WeightRecipeLike = {
  servings?: number | null;
  ingredients?: IngredientWithMaster[] | null;
  components?: RecipeComponentWithRelations[] | null;
};

/**
 * Gewicht pro Portion in Gramm oder null, wenn sich nichts umrechnen lässt
 * (z.B. nur Stück-Einheiten ohne Referenzgewicht).
 */
export function gramsPerServing(
  recipe: WeightRecipeLike | null | undefined,
  selection?: VariantSelection | null,
): number | null {
  if (!recipe) return null;
  const node = {
    ...(recipe as unknown as RecipeNode),
    ingredients: recipe.ingredients ?? [],
    components: recipe.components ?? [],
  };
  const w = recipeWeightPerServing(node, 0, selection);
  return w.grams > 0 ? Math.round(w.grams * 10) / 10 : null;
}

/** Gramm-Eingabe in einen (nicht ganzzahligen) Portionsfaktor umrechnen. */
export function gramsToServings(grams: number, perServing: number | null): number | null {
  if (!perServing || perServing <= 0 || !Number.isFinite(grams) || grams <= 0) return null;
  return Math.round((grams / perServing) * 1000) / 1000;
}

/** Portionsfaktor in Gramm umrechnen. */
export function servingsToGrams(servings: number, perServing: number | null): number | null {
  if (!perServing || perServing <= 0) return null;
  return Math.round(servings * perServing);
}
