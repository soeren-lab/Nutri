import { useMemo } from "react";
import type { IngredientWithMaster, RecipeWithRelations } from "@/types/recipe";
import { resolveIngredients, type ResolvedIngredient } from "@/lib/resolveIngredient";
import { sumNutrition } from "@/lib/nutrition-db";
import { freeIngredients } from "@/lib/componentNutrition";
import { normalizeUnit, unitKind } from "@/lib/unitConversion";

export interface ScaledIngredient extends ResolvedIngredient {
  scaledAmount: number | null;
  displayAmount: string;
}

function formatAmount(amount: number | null, unit: string | null): string {
  if (amount == null) return "";
  const u = unit ? normalizeUnit(unit) : "";
  const kind = u ? unitKind(u) : "unknown";
  if (kind === "piece") {
    // whole numbers preferred, else 1 decimal
    const rounded = Math.round(amount * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 0.05) return String(Math.round(rounded));
    return rounded.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  }
  // g/ml etc.: 1 decimal, strip trailing .0
  const rounded = Math.round(amount * 10) / 10;
  return rounded.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

/** Skaliert eine Zutatenliste um einen Faktor (inkl. Nährwerten). */
export function scaleIngredientList(
  rows: IngredientWithMaster[],
  factor: number,
): ScaledIngredient[] {
  return resolveIngredients(rows).map((r) => {
    const scale = (v: number | null) => (v == null ? null : Math.round(v * factor * 10) / 10);
    const scaledAmount = r.amount != null ? r.amount * factor : null;
    return {
      ...r,
      calories: scale(r.calories),
      protein_g: scale(r.protein_g),
      carbs_g: scale(r.carbs_g),
      fat_g: scale(r.fat_g),
      fiber_g: scale(r.fiber_g),
      sugar_g: scale(r.sugar_g),
      scaledAmount,
      displayAmount: formatAmount(scaledAmount, r.unit),
    };
  });
}

export function useScaledIngredients(recipe: RecipeWithRelations, targetServings: number) {
  return useMemo(() => {
    const base = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
    const factor = targetServings > 0 ? targetServings / base : 1;
    const scaled = scaleIngredientList(freeIngredients(recipe), factor);

    const mode = recipe.nutrition_mode ?? "simple";
    const totals =
      mode === "advanced"
        ? sumNutrition(scaled)
        : {
            calories: recipe.calories != null ? Math.round(recipe.calories * factor * 10) / 10 : null,
            protein_g: recipe.protein_g != null ? Math.round(recipe.protein_g * factor * 10) / 10 : null,
            carbs_g: recipe.carbs_g != null ? Math.round(recipe.carbs_g * factor * 10) / 10 : null,
            fat_g: recipe.fat_g != null ? Math.round(recipe.fat_g * factor * 10) / 10 : null,
            fiber_g:
              recipe.fiber_g != null ? Math.round(recipe.fiber_g * factor * 10) / 10 : null,
            sugar_g:
              recipe.sugar_g != null ? Math.round(recipe.sugar_g * factor * 10) / 10 : null,
          };

    return { scaled, totals, factor };
  }, [recipe, targetServings]);
}
