import { getColorForProgress, getNutritionColor } from "@/lib/nutritionScore";

export function useNutritionColor(
  protein_g: number | null | undefined,
  calories: number | null | undefined,
): string {
  return getNutritionColor(protein_g, calories);
}

/** Generisch: Farbe nach Zielerreichung (Ist/Soll) für kcal, Protein, KH, Fett. */
export function useProgressColor(
  current: number | null | undefined,
  target: number | null | undefined,
): string {
  return getColorForProgress(current, target);
}
