import { useMemo } from "react";
import type { RecipeComponentWithRelations, RecipeNode } from "@/types/recipe";
import {
  componentNutritionPerServing,
  recipeReferenceTotals,
  totalsForServingsMap,
  type NutritionTotals,
} from "@/lib/componentNutrition";

export interface ComponentNutritionEntry {
  component: RecipeComponentWithRelations;
  /** Nährwerte für eine Portion dieser Komponente. */
  perServing: NutritionTotals;
}

/**
 * Rekursive Nährwert-Berechnung über Rezept-Komponenten.
 * `servingsByComponent` erlaubt individuelle Portionen (Kochmodus).
 */
export function useComponentNutrition(
  recipe: RecipeNode,
  servingsByComponent?: Record<string, number>,
  freeServings?: number,
  selection?: Record<string, string> | null,
) {
  return useMemo(() => {
    const components: ComponentNutritionEntry[] = (recipe.components ?? []).map((c) => ({
      component: c,
      perServing: componentNutritionPerServing(c, 0, selection),
    }));
    const reference = recipeReferenceTotals(recipe, selection);
    const totals = servingsByComponent
      ? totalsForServingsMap(
          recipe,
          servingsByComponent,
          freeServings ?? (recipe.servings && recipe.servings > 0 ? recipe.servings : 1),
          selection,
        )
      : reference;
    return { components, reference, totals };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe, servingsByComponent, freeServings, selection]);
}
