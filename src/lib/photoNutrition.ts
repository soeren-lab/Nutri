import { z } from "zod";
import { computeNutritionFromMaster } from "@/lib/unitConversion";
import { amountInGrams, lookupNutrition } from "@/lib/nutrition-db";

/** Nährwerte pro 100 g/ml – nur Fallback für Positionen ohne Treffer in der Bibliothek. */
export const per100Schema = z.object({
  calories: z.number().min(0).max(950),
  protein_g: z.number().min(0).max(100),
  carbs_g: z.number().min(0).max(100),
  fat_g: z.number().min(0).max(100),
  fiber_g: z.number().min(0).max(100).nullish(),
  sugar_g: z.number().min(0).max(100).nullish(),
});

/** Eine erkannte/bearbeitete Position einer Foto-Auswertung. */
export const scanItemSchema = z.object({
  name: z.string().min(1).max(80),
  /** ID der Stammzutat in der Bibliothek, falls zugeordnet. */
  master_id: z.string().nullable(),
  amount: z.number().positive().max(5000),
  unit: z.string().min(1).max(12),
  /** Plausible Untergrenze/Obergrenze derselben Menge (gleiche Einheit). */
  low: z.number().positive().max(5000),
  high: z.number().positive().max(5000),
  confidence: z.enum(["high", "medium", "low"]),
  /** Nur gesetzt, wenn weder Bibliothek noch Richtwert-Tabelle die Zutat kennen. */
  per100: per100Schema.nullish(),
});

export type ScanItem = z.infer<typeof scanItemSchema>;

export const scanResultSchema = z.object({
  summary_name: z.string().min(1).max(80),
  items: z.array(scanItemSchema).max(30),
  /** Höchstens eine Rückfrage, wenn eine Position viele kcal ausmacht und unklar ist. */
  question: z.string().max(200).nullish(),
});

export type ScanResult = z.infer<typeof scanResultSchema>;

export type ScanMaster = {
  id: string;
  name: string;
  unit: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  density_g_per_ml?: number | null;
};

export type ScanMacros = {
  calories: number;
  fat_g: number;
  carbs_g: number;
  sugar_g: number;
  fiber_g: number;
  protein_g: number;
};

/**
 * Herkunft der Nährwerte einer Position:
 * - library: Stammzutat aus der Bibliothek des Users (genaue Werte pro 100 g)
 * - table:   Richtwert-Tabelle der App
 * - estimate: reine KI-Schätzung (grob)
 * - unknown: keine Nährwerte ermittelbar
 */
export type ScanSource = "library" | "table" | "estimate" | "unknown";

const ZERO: ScanMacros = {
  calories: 0,
  fat_g: 0,
  carbs_g: 0,
  sugar_g: 0,
  fiber_g: 0,
  protein_g: 0,
};

function scale(m: ScanMacros, factor: number): ScanMacros {
  return {
    calories: m.calories * factor,
    fat_g: m.fat_g * factor,
    carbs_g: m.carbs_g * factor,
    sugar_g: m.sugar_g * factor,
    fiber_g: m.fiber_g * factor,
    protein_g: m.protein_g * factor,
  };
}

function add(a: ScanMacros, b: ScanMacros): ScanMacros {
  return {
    calories: a.calories + b.calories,
    fat_g: a.fat_g + b.fat_g,
    carbs_g: a.carbs_g + b.carbs_g,
    sugar_g: a.sugar_g + b.sugar_g,
    fiber_g: a.fiber_g + b.fiber_g,
    protein_g: a.protein_g + b.protein_g,
  };
}

function fromPer100(
  p: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number | null;
    sugar_g?: number | null;
  },
  grams: number,
): ScanMacros {
  const f = grams / 100;
  return {
    calories: p.calories * f,
    fat_g: p.fat_g * f,
    carbs_g: p.carbs_g * f,
    sugar_g: (p.sugar_g ?? 0) * f,
    fiber_g: (p.fiber_g ?? 0) * f,
    protein_g: p.protein_g * f,
  };
}

/** Nährwerte einer Position bei einer bestimmten Menge (Einheit bleibt die der Position). */
export function macrosForAmount(
  item: Pick<ScanItem, "name" | "master_id" | "unit" | "per100">,
  amount: number,
  masters: ReadonlyMap<string, ScanMaster>,
): { macros: ScanMacros; source: ScanSource } {
  const master = item.master_id ? masters.get(item.master_id) : undefined;
  if (master) {
    const n = computeNutritionFromMaster(master, amount, item.unit);
    if (n.convertible && n.calories != null) {
      return {
        macros: {
          calories: n.calories,
          fat_g: n.fat_g ?? 0,
          carbs_g: n.carbs_g ?? 0,
          sugar_g: n.sugar_g ?? 0,
          fiber_g: n.fiber_g ?? 0,
          protein_g: n.protein_g ?? 0,
        },
        source: "library",
      };
    }
  }
  const grams = amountInGrams(amount, item.unit) ?? (item.unit === "ml" ? amount : null);
  if (grams != null) {
    const table = lookupNutrition(item.name);
    if (table) return { macros: fromPer100(table, grams), source: "table" };
    if (item.per100) return { macros: fromPer100(item.per100, grams), source: "estimate" };
  }
  return { macros: ZERO, source: "unknown" };
}

export type ScanTotals = {
  macros: ScanMacros;
  /** kcal-Spanne (untere/obere Grenze), Positionen als gleichgerichtet angenommen. */
  kcalLow: number;
  kcalHigh: number;
  sources: ScanSource[];
};

/** Summiert alle Positionen inkl. kcal-Spanne. Nährwerte kommen nie aus der KI-Rechnung. */
export function computeScanTotals(
  items: readonly ScanItem[],
  masters: ReadonlyMap<string, ScanMaster>,
): ScanTotals {
  let macros = ZERO;
  let kcalLow = 0;
  let kcalHigh = 0;
  const sources: ScanSource[] = [];
  for (const item of items) {
    const mid = macrosForAmount(item, item.amount, masters);
    const lo = macrosForAmount(item, Math.min(item.low, item.amount), masters);
    const hi = macrosForAmount(item, Math.max(item.high, item.amount), masters);
    macros = add(macros, mid.macros);
    kcalLow += lo.macros.calories;
    kcalHigh += hi.macros.calories;
    sources.push(mid.source);
  }
  return { macros, kcalLow, kcalHigh, sources };
}

/** Rundet auf ganze kcal/Gramm für Anzeige und Speicherung. */
export function roundMacros(m: ScanMacros): ScanMacros {
  const r = (n: number) => Math.round(n);
  return {
    calories: r(m.calories),
    fat_g: r(m.fat_g),
    carbs_g: r(m.carbs_g),
    sugar_g: r(m.sugar_g),
    fiber_g: r(m.fiber_g),
    protein_g: r(m.protein_g),
  };
}

/** Menge ändern: die Spanne wandert proportional mit. */
export function withAmount(item: ScanItem, amount: number): ScanItem {
  const ratio = item.amount > 0 ? amount / item.amount : 1;
  return {
    ...item,
    amount,
    low: Math.max(0.1, item.low * ratio),
    high: Math.max(0.1, item.high * ratio),
  };
}

/** Anzeigename aus den kalorienreichsten Positionen („Reis, Hähnchen, Brokkoli“). */
export function summaryNameFrom(
  items: readonly ScanItem[],
  masters: ReadonlyMap<string, ScanMaster>,
): string {
  const ranked = items
    .map((i) => ({ i, kcal: macrosForAmount(i, i.amount, masters).macros.calories }))
    .sort((a, b) => b.kcal - a.kcal)
    .slice(0, 3)
    .map((x) => x.i.name);
  return ranked.join(", ") || "Foto-Mahlzeit";
}

/** Liest gespeicherte Positionen (jsonb) wieder ein; ungültige Einträge werden verworfen. */
export function parseStoredItems(value: unknown): ScanItem[] {
  if (!Array.isArray(value)) return [];
  const out: ScanItem[] = [];
  for (const v of value) {
    const parsed = scanItemSchema.safeParse(v);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
