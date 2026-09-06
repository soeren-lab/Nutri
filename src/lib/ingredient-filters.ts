import type { IngredientMaster } from "@/lib/ingredients-master";

/** Nährwert-Felder, nach denen sortiert und gefiltert werden kann. */
export const NUTRIENT_FIELDS = [
  "calories",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fiber_g",
  "sugar_g",
] as const;

export type NutrientField = (typeof NUTRIENT_FIELDS)[number];

export const NUTRIENT_LABELS: Record<NutrientField, string> = {
  calories: "kcal",
  protein_g: "Protein",
  carbs_g: "Kohlenhydrate",
  fat_g: "Fett",
  fiber_g: "Ballaststoffe",
  sugar_g: "Zucker",
};

export const NUTRIENT_UNITS: Record<NutrientField, string> = {
  calories: "kcal",
  protein_g: "g",
  carbs_g: "g",
  fat_g: "g",
  fiber_g: "g",
  sugar_g: "g",
};

export type IngredientSort =
  | "name_asc"
  | "name_desc"
  | `${NutrientField}_asc`
  | `${NutrientField}_desc`;

export const INGREDIENT_SORT_LABELS: Record<IngredientSort, string> = {
  name_asc: "Name A–Z",
  name_desc: "Name Z–A",
  calories_asc: "kcal (niedrig → hoch)",
  calories_desc: "kcal (hoch → niedrig)",
  protein_g_asc: "Protein (niedrig → hoch)",
  protein_g_desc: "Protein (hoch → niedrig)",
  carbs_g_asc: "Kohlenhydrate (niedrig → hoch)",
  carbs_g_desc: "Kohlenhydrate (hoch → niedrig)",
  fat_g_asc: "Fett (niedrig → hoch)",
  fat_g_desc: "Fett (hoch → niedrig)",
  fiber_g_asc: "Ballaststoffe (niedrig → hoch)",
  fiber_g_desc: "Ballaststoffe (hoch → niedrig)",
  sugar_g_asc: "Zucker (niedrig → hoch)",
  sugar_g_desc: "Zucker (hoch → niedrig)",
};

export type NutrientRange = { min: number | null; max: number | null };
export type NutrientFilters = Partial<Record<NutrientField, NutrientRange>>;

export const EMPTY_NUTRIENT_FILTERS: NutrientFilters = {};

export function isRangeSet(r: NutrientRange | undefined): boolean {
  return !!r && (r.min != null || r.max != null);
}

export function activeFilterCount(f: NutrientFilters): number {
  return NUTRIENT_FIELDS.filter((k) => isRangeSet(f[k])).length;
}

export function describeRange(field: NutrientField, r: NutrientRange): string {
  const unit = NUTRIENT_UNITS[field];
  const label = NUTRIENT_LABELS[field];
  if (r.min != null && r.max != null)
    return `${label} ${r.min}–${r.max} ${unit}`;
  if (r.min != null) return `${label} ab ${r.min} ${unit}`;
  return `${label} max. ${r.max} ${unit}`;
}

/** UND-Verknüpfte Prüfung aller gesetzten Nährwert-Grenzen. */
export function matchesNutrientFilters(
  m: IngredientMaster,
  filters: NutrientFilters,
): boolean {
  for (const field of NUTRIENT_FIELDS) {
    const r = filters[field];
    if (!isRangeSet(r)) continue;
    const value = m[field];
    if (value == null) return false;
    if (r!.min != null && value < r!.min) return false;
    if (r!.max != null && value > r!.max) return false;
  }
  return true;
}

/** Sortierung; fehlende Werte landen immer am Ende. */
export function sortIngredients(
  list: IngredientMaster[],
  sort: IngredientSort,
): IngredientMaster[] {
  const out = [...list];
  if (sort === "name_asc" || sort === "name_desc") {
    out.sort((a, b) => a.name.localeCompare(b.name, "de"));
    if (sort === "name_desc") out.reverse();
    return out;
  }
  const dir = sort.endsWith("_desc") ? -1 : 1;
  const field = sort.replace(/_(asc|desc)$/, "") as NutrientField;
  out.sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return a.name.localeCompare(b.name, "de");
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av === bv) return a.name.localeCompare(b.name, "de");
    return (av - bv) * dir;
  });
  return out;
}
