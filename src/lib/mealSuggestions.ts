import {
  foodMacros,
  recipeNutritionPerServing,
  type IngredientMasterRow,
  type MacroTotals,
  type MealSlot,
} from "@/lib/meal-plan";
import { unitKind } from "@/lib/unitConversion";
import type { IngredientWithMaster, Recipe } from "@/types/recipe";

export type SuggestionKind = "recipe" | "ingredient";

export type Suggestion = {
  key: string;
  kind: SuggestionKind;
  id: string;
  title: string;
  imageUrl: string | null;
  macros: MacroTotals;
  /** Portionen (Rezept) bzw. Menge + Einheit (Lebensmittel). */
  servings: number | null;
  amount: number | null;
  unit: string | null;
  reason: string;
};

export type SuggestionResult = {
  /** Primäre Vorschläge: Rezepte. */
  recipes: Suggestion[];
  /** Ergänzungen: Einzel-Lebensmittel. */
  supplements: Suggestion[];
};

export type RecipeCandidate = Recipe & { ingredients?: IngredientWithMaster[] };

/** Verbleibendes Tagesbudget = Ziel − bereits geplant. */
export function remainingBudget(
  targets: MacroTotals,
  planned: MacroTotals | null,
): MacroTotals {
  const p = planned ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  return {
    calories: targets.calories - p.calories,
    protein_g: targets.protein_g - p.protein_g,
    carbs_g: targets.carbs_g - p.carbs_g,
    fat_g: targets.fat_g - p.fat_g,
    fiber_g: targets.fiber_g - p.fiber_g,
  };
}

/* ------------------------------------- Pro-Mahlzeit-Budget (Verteilung) */

/** Typische Anteile am Tagesbudget je Mahlzeit; Rest = Puffer für Snacks. */
export const MEAL_SLOT_WEIGHTS: Record<string, number> = {
  Frühstück: 0.25,
  Mittag: 0.35,
  Abend: 0.3,
  Snack: 0.1,
};

export const DEFAULT_SLOT_WEIGHT = 0.1;

export function slotWeight(slot: string): number {
  return MEAL_SLOT_WEIGHTS[slot] ?? DEFAULT_SLOT_WEIGHT;
}

/**
 * Verteilt das verbleibende Tagesbudget auf die noch offenen Mahlzeiten.
 * Nur die Gewichte der offenen Slots (inkl. dem aktuellen) zählen, normalisiert
 * auf 1 – so beansprucht ein Slot nie den kompletten Tagesrest, wenn noch
 * weitere Mahlzeiten offen sind.
 */
export function calculateSlotTarget(
  dailyTarget: MacroTotals,
  alreadyConsumed: MacroTotals | null,
  openSlotsWithWeights: Array<{ slot: string; weight: number }>,
  currentSlot: string,
): MacroTotals {
  const remaining = remainingBudget(dailyTarget, alreadyConsumed);
  const open =
    openSlotsWithWeights.length > 0
      ? openSlotsWithWeights
      : [{ slot: currentSlot, weight: slotWeight(currentSlot) }];
  const sum = open.reduce((acc, s) => acc + s.weight, 0);
  const own = open.find((s) => s.slot === currentSlot)?.weight ?? slotWeight(currentSlot);
  const share = sum > 0 ? own / sum : 1;
  return {
    calories: remaining.calories * share,
    protein_g: remaining.protein_g * share,
    carbs_g: remaining.carbs_g * share,
    fat_g: remaining.fat_g * share,
    fiber_g: remaining.fiber_g * share,
  };
}

const round = (n: number) => Math.round(n);

/* ------------------------------------------------- Schritt 1: Ausschlüsse */

/** Kategorien, die als Mahlzeit/Ergänzung nie sinnvoll sind. */
const EXCLUDED_CATEGORIES = ["Öle & Fette", "Süßungsmittel", "Gewürze & Kräuter"];

/** Alkohol wird unabhängig von Kategorie und Nährwerten ausgeschlossen. */
const ALCOHOL_WORDS = [
  "wein",
  "bier",
  "likör",
  "cognac",
  "schnaps",
  "whisky",
  "vodka",
  "rum",
];

function isAlcohol(name: string): boolean {
  const n = name.toLowerCase();
  return ALCOHOL_WORDS.some((w) => n.includes(w));
}

/** Kategorien, die als eigenständiger Vorschlag plausibel sind. */
const STANDALONE_CATEGORIES = [
  "Obst",
  "Gemüse",
  "Milchprodukte",
  "Fleisch & Fisch",
  "Getreide & Backwaren",
  "Nüsse & Samen",
  "Hülsenfrüchte",
];

/** Einzel-Lebensmittel-Filter (gilt nicht für Rezepte). */
export function isEligibleFood(master: IngredientMasterRow): boolean {
  const category = (master as { category?: string | null }).category ?? null;
  if (category && EXCLUDED_CATEGORIES.includes(category)) return false;
  // Nur plausible eigenständige Lebensmittel (kein Salz, keine Backzutaten …).
  if (!category || !STANDALONE_CATEGORIES.includes(category)) return false;
  if (isAlcohol(master.name)) return false;
  const protein = master.protein_g != null ? Number(master.protein_g) : 0;
  if (protein <= 0) return false;
  return true;
}


/* --------------------------------------- Schritt 2: realistische Mengen */

/** Obergrenzen je Kategorie, wenn keine Nutzungshistorie vorliegt. */
export const CATEGORY_MAX_AMOUNTS: Record<string, number> = {
  Getränke: 250,
  Milchprodukte: 250,
  "Fleisch & Fisch": 200,
  Gemüse: 200,
  Obst: 200,
  "Getreide & Backwaren": 100,
  Sonstiges: 150,
};

const TYPICAL_FACTOR = 1.5;

function typicalAmountFor(
  master: IngredientMasterRow,
  typical: Map<string, number> | undefined,
): number {
  const known = typical?.get(master.id);
  if (known && known > 0) return known;
  const category = (master as { category?: string | null }).category ?? "Sonstiges";
  if (unitKind(master.unit) === "piece") return 2;
  return CATEGORY_MAX_AMOUNTS[category] ?? CATEGORY_MAX_AMOUNTS["Sonstiges"];
}

/** Menge fürs Budget, gedeckelt auf 1,5× der üblichen Menge. */
function suggestAmount(
  master: IngredientMasterRow,
  remainingKcal: number,
  typical: Map<string, number> | undefined,
): number | null {
  const per = master.calories != null ? Number(master.calories) : null;
  if (!per || per <= 0) return null;
  const cap = typicalAmountFor(master, typical) * TYPICAL_FACTOR;
  if (unitKind(master.unit) === "piece") {
    const needed = remainingKcal / per;
    const pieces = Math.round(Math.min(needed, cap));
    return Math.max(1, pieces);
  }
  const needed = (remainingKcal / per) * 100;
  const amount = Math.min(needed, cap);
  const rounded = Math.round(amount / 10) * 10;
  return Math.max(10, rounded);
}

/* --------------------------------- Schritt 3: Slot → Kategorie-Matching */

export const SLOT_CATEGORY_MAP: Record<MealSlot, string[]> = {
  Frühstück: ["Frühstück"],
  Mittag: ["Hauptgericht", "Vorspeise", "Beilage"],
  Abend: ["Hauptgericht", "Vorspeise", "Beilage", "Suppe"],
};

function matchesSlot(recipe: RecipeCandidate, slot: MealSlot | null): boolean {
  if (!slot) return false;
  const wanted = SLOT_CATEGORY_MAP[slot] ?? [];
  const cats = (recipe.categories ?? []) as string[];
  return cats.some((c) => wanted.includes(c));
}

/* ---------------------------------------------- Sortierung & Bewertung */

const KCAL_MIN_SHARE = 0.8;
const KCAL_MAX_SHARE = 1.1;
/** Protein darf bis +20 % über dem Restbedarf liegen, ohne Malus. */
const PROTEIN_TOLERANCE = 1.2;
/** Mindest-Proteindichte für Rezepte: 5 g Protein pro 100 kcal. */
const MIN_PROTEIN_PER_100KCAL = 5;
/** Ab dieser Lücke lohnt eine Ergänzung. */
const GAP_SHARE_FOR_SUPPLEMENTS = 0.25;
const MIN_RECIPE_HITS = 3;

function hasEnoughProtein(macros: MacroTotals): boolean {
  if (macros.calories <= 0) return false;
  return (macros.protein_g / macros.calories) * 100 >= MIN_PROTEIN_PER_100KCAL;
}

function reasonFor(macros: MacroTotals, remaining: MacroTotals, slotMatch: boolean): string {
  const base = `Deckt ${round(macros.calories)} kcal, ${round(macros.protein_g)} g Protein`;
  const prefix = slotMatch ? "Passt zur Mahlzeit · " : "";
  if (remaining.calories <= 0) return prefix + base;
  const share = macros.calories / remaining.calories;
  if (share < KCAL_MIN_SHARE) return `${prefix}${base} – lässt noch Luft im Budget`;
  if (share <= 1) return `${prefix}${base} – passt gut`;
  return `${prefix}${base} – etwas über deinem Budget`;
}

/**
 * Vorschlags-Pipeline:
 * 1. Ausschlüsse (Kategorien, Alkohol, proteinfreie Einzel-Lebensmittel)
 * 2. realistische Mengen (Nutzungshistorie bzw. Kategorie-Deckel × 1,5)
 * 3. Slot→Kategorie-Boost für Rezepte
 * 4. Rezepte primär, Einzel-Lebensmittel nur als Ergänzung
 */
export function buildSuggestions(input: {
  remaining: MacroTotals;
  recipes: RecipeCandidate[];
  foods: IngredientMasterRow[];
  slot?: MealSlot | null;
  typicalAmounts?: Map<string, number>;
  limit?: number;
}): SuggestionResult {
  const { remaining, recipes, foods, slot = null, typicalAmounts, limit = 5 } = input;
  if (remaining.calories <= 0) return { recipes: [], supplements: [] };

  const min = remaining.calories * KCAL_MIN_SHARE;
  const max = remaining.calories * KCAL_MAX_SHARE;

  const proteinTarget = Math.max(0, remaining.protein_g);
  const proteinCap = proteinTarget * PROTEIN_TOLERANCE;
  const proteinScore = (p: number) => {
    if (proteinTarget <= 0) return 1;
    if (p <= proteinCap) return Math.min(1, p / proteinTarget);
    return Math.max(0, 1 - (p - proteinCap) / proteinCap);
  };
  
  const inTolerance = (kcal: number) => kcal >= min && kcal <= max;

  /* Rezepte */
  const macroDistance = (m: MacroTotals) =>
    Math.abs(m.calories - remaining.calories) / Math.max(1, remaining.calories) +
    Math.abs(m.protein_g - remaining.protein_g) / Math.max(1, remaining.protein_g) +
    0.5 * (Math.abs(m.carbs_g - remaining.carbs_g) / Math.max(1, remaining.carbs_g)) +
    0.5 * (Math.abs(m.fat_g - remaining.fat_g) / Math.max(1, remaining.fat_g));

  const recipeHits: Array<Suggestion & { slotMatch: boolean }> = [];
  for (const r of recipes) {
    if (r.is_component_only) continue;
    const per = recipeNutritionPerServing(r);
    if (!per || per.calories <= 0) continue;
    if (per.calories < min || per.calories > max) continue;
    if (!hasEnoughProtein(per)) continue;
    const slotMatch = matchesSlot(r, slot);
    // Slot-Filter ist hart: im Frühstücks-Slot nur Frühstücks-Rezepte usw.
    if (slot && !slotMatch) continue;
    recipeHits.push({
      key: `recipe:${r.id}`,
      kind: "recipe",
      id: r.id,
      title: r.title,
      imageUrl: r.image_url ?? null,
      macros: per,
      servings: 1,
      amount: null,
      unit: null,
      reason: reasonFor(per, remaining, slotMatch),
      slotMatch,
    });
  }

  recipeHits.sort((a, b) => {
    const aTol = inTolerance(a.macros.calories);
    const bTol = inTolerance(b.macros.calories);
    if (aTol !== bTol) return aTol ? -1 : 1;
    const d = macroDistance(a.macros) - macroDistance(b.macros);
    if (Math.abs(d) > 0.01) return d;
    return proteinScore(b.macros.protein_g) - proteinScore(a.macros.protein_g);
  });


  const topRecipes = recipeHits.slice(0, limit).map(({ slotMatch: _s, ...rest }) => rest);

  /* Ergänzungen nur bei zu wenigen Treffern oder spürbarer Restlücke */
  const bestRecipeKcal = topRecipes[0]?.macros.calories ?? 0;
  const gap = remaining.calories - bestRecipeKcal;
  const needSupplements =
    topRecipes.length < MIN_RECIPE_HITS ||
    gap > remaining.calories * GAP_SHARE_FOR_SUPPLEMENTS;

  let supplements: Suggestion[] = [];
  if (needSupplements) {
    const budget = topRecipes.length > 0 ? Math.max(gap, 0) : remaining.calories;
    const sMin = budget * KCAL_MIN_SHARE;
    const sMax = budget * KCAL_MAX_SHARE;
    const hits: Suggestion[] = [];
    for (const f of foods) {
      if (f.archived) continue;
      if (!isEligibleFood(f)) continue;
      const amount = suggestAmount(f, budget, typicalAmounts);
      if (amount == null) continue;
      const macros = foodMacros(f, amount, f.unit);
      if (!macros || macros.calories <= 0) continue;
      if (budget > 0 && (macros.calories < sMin || macros.calories > sMax)) continue;
      hits.push({
        key: `ingredient:${f.id}`,
        kind: "ingredient",
        id: f.id,
        title: f.name,
        imageUrl: f.image_url ?? null,
        macros,
        servings: null,
        amount,
        unit: f.unit,
        reason: reasonFor(macros, remaining, false),
      });
    }
    hits.sort((a, b) => {
      const diff = proteinScore(b.macros.protein_g) - proteinScore(a.macros.protein_g);
      if (Math.abs(diff) > 0.01) return diff;
      return Math.abs(a.macros.calories - budget) - Math.abs(b.macros.calories - budget);
    });
    supplements = hits.slice(0, Math.max(0, limit - topRecipes.length) || 2);
  }

  return { recipes: topRecipes, supplements };
}
