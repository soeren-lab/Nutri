export interface NutritionPer100 {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Ballaststoffe pro 100 g/ml (optional in der Richtwert-Tabelle). */
  fiber_g?: number;
  sugar_g?: number;
}

// Werte pro 100 g bzw. 100 ml (Richtwerte)
export const NUTRITION_DB: Record<string, NutritionPer100> = {
  mehl: { calories: 364, protein_g: 10, carbs_g: 76, fat_g: 1 },
  zucker: { calories: 387, protein_g: 0, carbs_g: 100, fat_g: 0 },
  butter: { calories: 717, protein_g: 0.9, carbs_g: 0.1, fat_g: 81 },
  margarine: { calories: 720, protein_g: 0.2, carbs_g: 0.7, fat_g: 80 },
  öl: { calories: 884, protein_g: 0, carbs_g: 0, fat_g: 100 },
  olivenöl: { calories: 884, protein_g: 0, carbs_g: 0, fat_g: 100 },
  milch: { calories: 64, protein_g: 3.4, carbs_g: 4.8, fat_g: 3.6 },
  sahne: { calories: 292, protein_g: 2.5, carbs_g: 3.3, fat_g: 30 },
  joghurt: { calories: 61, protein_g: 3.5, carbs_g: 4.7, fat_g: 3.3 },
  quark: { calories: 105, protein_g: 12, carbs_g: 4, fat_g: 5 },
  käse: { calories: 350, protein_g: 25, carbs_g: 1, fat_g: 27 },
  ei: { calories: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11 },
  eier: { calories: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11 },
  hähnchen: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
  hähnchenbrust: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
  rindfleisch: { calories: 250, protein_g: 26, carbs_g: 0, fat_g: 15 },
  hackfleisch: { calories: 254, protein_g: 26, carbs_g: 0, fat_g: 17 },
  schweinefleisch: { calories: 242, protein_g: 27, carbs_g: 0, fat_g: 14 },
  lachs: { calories: 208, protein_g: 20, carbs_g: 0, fat_g: 13 },
  thunfisch: { calories: 132, protein_g: 28, carbs_g: 0, fat_g: 1 },
  reis: { calories: 355, protein_g: 7, carbs_g: 78, fat_g: 1 },
  nudeln: { calories: 371, protein_g: 13, carbs_g: 75, fat_g: 1.5 },
  pasta: { calories: 371, protein_g: 13, carbs_g: 75, fat_g: 1.5 },
  brot: { calories: 265, protein_g: 9, carbs_g: 49, fat_g: 3.2 },
  kartoffel: { calories: 77, protein_g: 2, carbs_g: 17, fat_g: 0.1 },
  kartoffeln: { calories: 77, protein_g: 2, carbs_g: 17, fat_g: 0.1 },
  tomate: { calories: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2 },
  tomaten: { calories: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2 },
  zwiebel: { calories: 40, protein_g: 1.1, carbs_g: 9, fat_g: 0.1 },
  zwiebeln: { calories: 40, protein_g: 1.1, carbs_g: 9, fat_g: 0.1 },
  knoblauch: { calories: 149, protein_g: 6.4, carbs_g: 33, fat_g: 0.5 },
  paprika: { calories: 31, protein_g: 1, carbs_g: 6, fat_g: 0.3 },
  karotte: { calories: 41, protein_g: 0.9, carbs_g: 10, fat_g: 0.2 },
  karotten: { calories: 41, protein_g: 0.9, carbs_g: 10, fat_g: 0.2 },
  möhre: { calories: 41, protein_g: 0.9, carbs_g: 10, fat_g: 0.2 },
  möhren: { calories: 41, protein_g: 0.9, carbs_g: 10, fat_g: 0.2 },
  spinat: { calories: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4 },
  salat: { calories: 15, protein_g: 1.4, carbs_g: 2.9, fat_g: 0.2 },
  apfel: { calories: 52, protein_g: 0.3, carbs_g: 14, fat_g: 0.2 },
  banane: { calories: 89, protein_g: 1.1, carbs_g: 23, fat_g: 0.3 },
  zitrone: { calories: 29, protein_g: 1.1, carbs_g: 9, fat_g: 0.3 },
  honig: { calories: 304, protein_g: 0.3, carbs_g: 82, fat_g: 0 },
  schokolade: { calories: 546, protein_g: 4.9, carbs_g: 61, fat_g: 31 },
  wasser: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  salz: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  pfeffer: { calories: 251, protein_g: 10, carbs_g: 64, fat_g: 3 },
};

const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  gramm: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  liter: 1000,
  el: 15,
  esslöffel: 15,
  tl: 5,
  teelöffel: 5,
  tasse: 240,
  becher: 200,
  prise: 0.5,
};

export function normalizeIngredientKey(name: string): string {
  return name.trim().toLowerCase();
}

export function lookupNutrition(name: string): NutritionPer100 | null {
  const key = normalizeIngredientKey(name);
  if (!key) return null;
  if (NUTRITION_DB[key]) return NUTRITION_DB[key];
  // fuzzy: match if any DB key is a whole word in the name
  for (const dbKey of Object.keys(NUTRITION_DB)) {
    const re = new RegExp(`\\b${dbKey}\\b`);
    if (re.test(key)) return NUTRITION_DB[dbKey];
  }
  return null;
}

export function amountInGrams(amount: number | null, unit: string | null): number | null {
  if (amount == null || !unit) return null;
  const factor = UNIT_TO_GRAMS[unit.trim().toLowerCase()];
  if (factor == null) return null;
  return amount * factor;
}

export interface IngredientNutrition {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
}

export function estimateNutrition(
  name: string,
  amount: number | null,
  unit: string | null,
): IngredientNutrition | null {
  const per100 = lookupNutrition(name);
  if (!per100) return null;
  const grams = amountInGrams(amount, unit);
  if (grams == null) return null;
  const f = grams / 100;
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    calories: round(per100.calories * f),
    protein_g: round(per100.protein_g * f),
    carbs_g: round(per100.carbs_g * f),
    fat_g: round(per100.fat_g * f),
    fiber_g: per100.fiber_g != null ? round(per100.fiber_g * f) : null,
    sugar_g: per100.sugar_g != null ? round(per100.sugar_g * f) : null,
  };
}

export function sumNutrition(
  rows: Array<Partial<IngredientNutrition>>,
): { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; sugar_g: number } {
  const total = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0 };
  for (const r of rows) {
    total.calories += Number(r.calories ?? 0) || 0;
    total.protein_g += Number(r.protein_g ?? 0) || 0;
    total.carbs_g += Number(r.carbs_g ?? 0) || 0;
    total.fat_g += Number(r.fat_g ?? 0) || 0;
    total.fiber_g += Number(r.fiber_g ?? 0) || 0;
    total.sugar_g += Number(r.sugar_g ?? 0) || 0;
  }
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    calories: round(total.calories),
    protein_g: round(total.protein_g),
    carbs_g: round(total.carbs_g),
    fat_g: round(total.fat_g),
    fiber_g: round(total.fiber_g),
    sugar_g: round(total.sugar_g),
  };
}
