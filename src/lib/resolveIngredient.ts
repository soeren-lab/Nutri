import type { IngredientWithMaster } from "@/types/recipe";
import { computeNutritionFromMaster } from "@/lib/unitConversion";
import { sumNutrition } from "@/lib/nutrition-db";
import { GROUP_HINT, isUnresolvedGroupIngredient } from "@/lib/productGroups";

export type ResolvedIngredient = {
  id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  ingredient_master_id: string | null;
  fromMaster: boolean;
  /** Produktgruppe, falls die Sorte erst beim Kochen gewählt wird. */
  productGroup: string | null;
  isGroup: boolean;
};

/**
 * Live-Auflösung einer Zutat: Wenn eine Stammzutat verknüpft ist,
 * werden Name und Nährwerte aus der aktuellen Stammzutat berechnet.
 * Fällt die Umrechnung fehl (z.B. Stück ↔ g), werden gespeicherte
 * Werte als Fallback verwendet.
 */
export function resolveIngredient(ing: IngredientWithMaster): ResolvedIngredient {
  const master = ing.master;
  if (isUnresolvedGroupIngredient(ing)) {
    const group = ing.product_group as string;
    return {
      id: ing.id,
      name: `${group} (${GROUP_HINT})`,
      amount: ing.amount,
      unit: ing.unit,
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      fiber_g: null,
      sugar_g: null,
      ingredient_master_id: null,
      fromMaster: false,
      productGroup: group,
      isGroup: true,
    };
  }
  if (master) {
    const c = computeNutritionFromMaster(master, ing.amount, ing.unit);
    const usable = c.convertible;
    return {
      id: ing.id,
      name: master.name,
      amount: ing.amount,
      unit: ing.unit,
      calories: usable ? c.calories : ing.calories,
      protein_g: usable ? c.protein_g : ing.protein_g,
      carbs_g: usable ? c.carbs_g : ing.carbs_g,
      fat_g: usable ? c.fat_g : ing.fat_g,
      fiber_g: usable ? c.fiber_g : ing.fiber_g,
      sugar_g: usable ? c.sugar_g : ing.sugar_g,
      ingredient_master_id: ing.ingredient_master_id,
      fromMaster: true,
      productGroup: ing.product_group ?? null,
      isGroup: false,
    };
  }
  return {
    id: ing.id,
    name: ing.name,
    amount: ing.amount,
    unit: ing.unit,
    calories: ing.calories,
    protein_g: ing.protein_g,
    carbs_g: ing.carbs_g,
    fat_g: ing.fat_g,
    fiber_g: ing.fiber_g,
    sugar_g: ing.sugar_g,
    ingredient_master_id: null,
    fromMaster: false,
    productGroup: null,
    isGroup: false,
  };
}


export function resolveIngredients(rows: IngredientWithMaster[]): ResolvedIngredient[] {
  return rows.map(resolveIngredient);
}

export function computeAdvancedTotals(rows: IngredientWithMaster[]) {
  return sumNutrition(resolveIngredients(rows));
}
