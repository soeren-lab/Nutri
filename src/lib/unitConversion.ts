/**
 * Zentrale Einheiten-Definition und Umrechnung.
 * Gewicht (g) und Volumen (ml) sind über die Dichte umrechenbar.
 * Stück-artige Einheiten sind nicht automatisch umrechenbar.
 */

export const UNIT_OPTIONS = [
  "g",
  "kg",
  "ml",
  "l",
  "TL",
  "EL",
  "Tasse",
  "Stück",
  "Prise",
  "Packung",
  "Dose",
  "Bund",
  "Scheibe",
] as const;

export type Unit = (typeof UNIT_OPTIONS)[number];

export const UNIT_GROUPS: Array<{ label: string; units: readonly Unit[] }> = [
  { label: "Gewicht", units: ["g", "kg"] },
  { label: "Volumen", units: ["ml", "l", "TL", "EL", "Tasse"] },
  { label: "Stück", units: ["Stück", "Prise", "Packung", "Dose", "Bund", "Scheibe"] },
];

const WEIGHT_TO_G: Record<string, number> = { g: 1, kg: 1000 };
const VOL_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  TL: 5,
  EL: 15,
  Tasse: 240,
};
const PIECE_UNITS = new Set(["Stück", "Stk", "Prise", "Packung", "Dose", "Bund", "Scheibe"]);

export type UnitKind = "weight" | "volume" | "piece" | "unknown";

/** Legacy „Stk" → „Stück". */
export function normalizeUnit(u: string): string {
  if (u === "Stk") return "Stück";
  return u;
}

export function unitKind(u: string): UnitKind {
  const n = normalizeUnit(u);
  if (n in WEIGHT_TO_G) return "weight";
  if (n in VOL_TO_ML) return "volume";
  if (PIECE_UNITS.has(n)) return "piece";
  return "unknown";
}

/**
 * Wert von `from` in `to` konvertieren.
 * `density` in g/ml (Standard 1). Rückgabe null wenn nicht umrechenbar
 * (z. B. „Stück" ↔ „g" ohne Referenzgewicht).
 */
export function convert(
  value: number,
  from: string,
  to: string,
  density: number = 1,
): number | null {
  const f = normalizeUnit(from);
  const t = normalizeUnit(to);
  if (f === t) return value;
  const fk = unitKind(f);
  const tk = unitKind(t);
  if (fk === "piece" || tk === "piece") return null;
  if (fk === "unknown" || tk === "unknown") return null;

  // → Gramm
  let grams: number;
  if (fk === "weight") grams = value * WEIGHT_TO_G[f];
  else grams = value * VOL_TO_ML[f] * density;

  // Gramm →
  if (tk === "weight") return grams / WEIGHT_TO_G[t];
  return grams / (VOL_TO_ML[t] * density);
}

/**
 * Nährwerte aus einer Stammzutat für die angegebene Menge/Einheit im Rezept berechnen.
 * Gibt `convertible: false` zurück, wenn Rezept-Einheit nicht in die
 * Basis-Einheit der Stammzutat umgerechnet werden kann.
 */
export function computeNutritionFromMaster(
  master: {
    unit: string;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g?: number | null;
    sugar_g?: number | null;
    density_g_per_ml?: number | null;
  },
  amount: number | null,
  recipeUnit: string | null,
): {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  convertible: boolean;
} {
  if (amount == null || amount <= 0) {
    return {
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      fiber_g: null,
      sugar_g: null,
      convertible: true,
    };
  }
  const mu = normalizeUnit(master.unit);
  const ru = recipeUnit && recipeUnit.length > 0 ? normalizeUnit(recipeUnit) : mu;
  const density = master.density_g_per_ml ?? 1;
  const amountInMasterUnit = convert(amount, ru, mu, density);
  if (amountInMasterUnit == null) {
    return {
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      fiber_g: null,
      sugar_g: null,
      convertible: false,
    };
  }
  // Bei Stück-Basis: Werte gelten pro 1 Stück. Bei g/ml: pro 100.
  const factor = unitKind(mu) === "piece" ? amountInMasterUnit : amountInMasterUnit / 100;
  const scale = (v: number | null | undefined) =>
    v == null ? null : Math.round(v * factor * 10) / 10;
  return {
    calories: scale(master.calories),
    protein_g: scale(master.protein_g),
    carbs_g: scale(master.carbs_g),
    fat_g: scale(master.fat_g),
    fiber_g: scale(master.fiber_g),
    sugar_g: scale(master.sugar_g),
    convertible: true,
  };
}
