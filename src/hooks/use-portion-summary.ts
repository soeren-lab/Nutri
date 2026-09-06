import { useMemo } from "react";
import { recipeNutritionPerServing, type MacroTotals } from "@/lib/meal-plan";
import {
  gramsPerServing,
  gramsToServings,
  servingsToGrams,
  type WeightRecipeLike,
} from "@/lib/portionWeight";
import type { VariantSelection } from "@/lib/variants";

export type PortionSummary = {
  /** Gesamtgewicht des Rezepts bei EINER Portion (null = nicht ermittelbar). */
  gramsPerServing: number | null;
  /** Nährwerte pro Portion (aktueller Stand). */
  perServing: MacroTotals | null;
  /** Gramm → Portionsfaktor (z.B. 350 g von 480 g = 0.729). */
  gramsToServings: (grams: number) => number | null;
  /** Portionsfaktor → Gramm. */
  servingsToGrams: (servings: number) => number | null;
  /** Nährwerte für einen beliebigen (auch nicht ganzzahligen) Faktor. */
  macrosFor: (factor: number) => MacroTotals | null;
};

/**
 * Portions- und Gewichts-Zusammenfassung eines Rezepts inkl. Umrechnung
 * zwischen Gramm und Portionen (für das Einplanen im Planer).
 */
export function usePortionSummary(
  recipe: (WeightRecipeLike & Parameters<typeof recipeNutritionPerServing>[0]) | null | undefined,
  selection?: VariantSelection | null,
): PortionSummary {
  return useMemo(() => {
    const per = recipe ? gramsPerServing(recipe, selection ?? null) : null;
    const macros = recipe ? recipeNutritionPerServing(recipe, selection ?? null) : null;
    return {
      gramsPerServing: per,
      perServing: macros,
      gramsToServings: (grams: number) => gramsToServings(grams, per),
      servingsToGrams: (servings: number) => servingsToGrams(servings, per),
      macrosFor: (factor: number) =>
        macros
          ? {
              calories: macros.calories * factor,
              protein_g: macros.protein_g * factor,
              carbs_g: macros.carbs_g * factor,
              fat_g: macros.fat_g * factor,
              fiber_g: macros.fiber_g * factor,
              sugar_g: (macros.sugar_g ?? 0) * factor,
            }
          : null,
    };
  }, [recipe, selection]);
}
