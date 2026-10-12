import { describe, expect, it } from "vitest";
import {
  computeScanTotals,
  macrosForAmount,
  parseStoredItems,
  roundMacros,
  summaryNameFrom,
  withAmount,
  type ScanItem,
  type ScanMaster,
} from "@/lib/photoNutrition";

const rice: ScanMaster = {
  id: "rice",
  name: "Reis, gekocht",
  unit: "g",
  calories: 130,
  protein_g: 2.7,
  carbs_g: 28,
  fat_g: 0.3,
  fiber_g: 0.4,
  sugar_g: 0,
};
const oil: ScanMaster = {
  id: "oil",
  name: "Olivenöl",
  unit: "ml",
  calories: 810,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 91,
  fiber_g: 0,
  sugar_g: 0,
  density_g_per_ml: 0.91,
};
const egg: ScanMaster = {
  id: "egg",
  name: "Ei",
  unit: "Stück",
  calories: 80,
  protein_g: 6.5,
  carbs_g: 0.5,
  fat_g: 5.5,
  fiber_g: 0,
  sugar_g: 0.5,
};
const masters = new Map([rice, oil, egg].map((m) => [m.id, m]));

function item(partial: Partial<ScanItem> & Pick<ScanItem, "name" | "amount" | "unit">): ScanItem {
  return {
    master_id: null,
    low: partial.amount * 0.8,
    high: partial.amount * 1.2,
    confidence: "medium",
    ...partial,
  };
}

describe("macrosForAmount", () => {
  it("rechnet Bibliotheks-Zutaten pro 100 g", () => {
    const r = macrosForAmount(
      item({ name: "Reis", master_id: "rice", amount: 200, unit: "g" }),
      200,
      masters,
    );
    expect(r.source).toBe("library");
    expect(r.macros.calories).toBeCloseTo(260);
    expect(r.macros.carbs_g).toBeCloseTo(56);
  });

  it("rechnet Stück-Zutaten pro Stück", () => {
    const r = macrosForAmount(
      item({ name: "Ei", master_id: "egg", amount: 2, unit: "Stück" }),
      2,
      masters,
    );
    expect(r.macros.calories).toBeCloseTo(160);
    expect(r.macros.protein_g).toBeCloseTo(13);
  });

  it("nutzt ohne Bibliothek die KI-Schätzung als grobe Quelle", () => {
    const it = item({
      name: "Exotische Soße",
      amount: 50,
      unit: "g",
      per100: { calories: 200, protein_g: 2, carbs_g: 20, fat_g: 12 },
    });
    const r = macrosForAmount(it, 50, masters);
    expect(r.source).toBe("estimate");
    expect(r.macros.calories).toBeCloseTo(100);
  });

  it("meldet unknown, wenn gar keine Nährwerte ermittelbar sind", () => {
    const r = macrosForAmount(
      item({ name: "Unbekanntes Ding", amount: 100, unit: "g" }),
      100,
      masters,
    );
    expect(r.source).toBe("unknown");
    expect(r.macros.calories).toBe(0);
  });
});

describe("computeScanTotals", () => {
  it("summiert Positionen und liefert eine Spanne", () => {
    const items = [
      item({ name: "Reis", master_id: "rice", amount: 200, unit: "g", low: 160, high: 240 }),
      item({ name: "Öl", master_id: "oil", amount: 10, unit: "ml", low: 5, high: 15 }),
    ];
    const t = computeScanTotals(items, masters);
    expect(t.macros.calories).toBeCloseTo(260 + 81);
    expect(t.kcalLow).toBeLessThan(t.macros.calories);
    expect(t.kcalHigh).toBeGreaterThan(t.macros.calories);
    expect(t.sources).toEqual(["library", "library"]);
  });
});

describe("Hilfsfunktionen", () => {
  it("withAmount skaliert die Spanne proportional", () => {
    const base = item({
      name: "Reis",
      master_id: "rice",
      amount: 100,
      unit: "g",
      low: 80,
      high: 120,
    });
    const next = withAmount(base, 200);
    expect(next.amount).toBe(200);
    expect(next.low).toBeCloseTo(160);
    expect(next.high).toBeCloseTo(240);
  });

  it("roundMacros rundet auf ganze Werte", () => {
    const r = roundMacros({
      calories: 639.6,
      fat_g: 19.4,
      carbs_g: 58.5,
      sugar_g: 2.1,
      fiber_g: 3.9,
      protein_g: 54.6,
    });
    expect(r).toEqual({
      calories: 640,
      fat_g: 19,
      carbs_g: 59,
      sugar_g: 2,
      fiber_g: 4,
      protein_g: 55,
    });
  });

  it("summaryNameFrom nennt die kalorienreichsten Positionen", () => {
    const items = [
      item({ name: "Reis", master_id: "rice", amount: 200, unit: "g" }),
      item({ name: "Olivenöl", master_id: "oil", amount: 40, unit: "ml" }),
      item({ name: "Ei", master_id: "egg", amount: 1, unit: "Stück" }),
    ];
    expect(summaryNameFrom(items, masters)).toBe("Olivenöl, Reis, Ei");
  });

  it("parseStoredItems verwirft ungültige Einträge", () => {
    const good = item({ name: "Reis", master_id: "rice", amount: 100, unit: "g" });
    expect(parseStoredItems([good, { name: "kaputt" }, null])).toEqual([good]);
    expect(parseStoredItems("nope")).toEqual([]);
  });
});
