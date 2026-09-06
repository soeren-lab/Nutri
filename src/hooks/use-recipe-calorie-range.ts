import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ingredientsMasterQuery } from "@/lib/ingredients-master";
import {
  formatCalorieRange,
  recipeCalorieRange,
  type CalorieRange,
} from "@/lib/calorieRange";
import type { RecipeLikeNode } from "@/lib/componentNutrition";

/**
 * Kalorien-Spanne pro Portion für die Übersicht-Karten.
 * Berücksichtigt Auswahl-Komponenten (Varianten) und flexible Zutaten.
 */
export function useRecipeCalorieRange(
  recipe: RecipeLikeNode | null | undefined,
): CalorieRange & { label: string | null } {
  const { data: masters } = useQuery(ingredientsMasterQuery());
  return useMemo(() => {
    const range = recipeCalorieRange(recipe, masters ?? []);
    return { ...range, label: formatCalorieRange(range) };
  }, [recipe, masters]);
}
