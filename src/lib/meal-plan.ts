import { supabase } from "@/integrations/supabase/client";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { freeIngredients, nutritionPerServing } from "@/lib/componentNutrition";
import { fetchRecipe, fetchRecipes } from "@/lib/recipes";
import { computeNutritionFromMaster } from "@/lib/unitConversion";
import { resolveIngredients } from "@/lib/resolveIngredient";
import {
  effectiveComponentIngredients,
  isChoiceComponent,
  parseVariantSelection,
  selectedVariantId,
  type VariantSelection,
} from "@/lib/variants";
import { applyGroupChoices, type GroupChoices } from "@/lib/productGroups";
import { ingredientsMasterQuery } from "@/lib/ingredients-master";
import type {
  IngredientWithMaster,
  Recipe,
  RecipeComponentWithRelations,
  RecipeListItem,
  RecipeNode,
  RecipeWithRelations,
} from "@/types/recipe";

/**
 * Liest ein Rezept bzw. eine Stammzutat zuerst aus dem (persistierten)
 * Query-Cache, bevor ein Netzwerk-Request versucht wird – nötig, damit der
 * Planer auch offline funktioniert, solange Rezepte/Zutaten schon einmal
 * geladen wurden.
 */
function cachedRecipe(qc: QueryClient | undefined, recipeId: string): RecipeListItem | undefined {
  return qc?.getQueryData<RecipeListItem[]>(["recipes"])?.find((r) => r.id === recipeId);
}

function cachedMaster(qc: QueryClient | undefined, id: string): IngredientMasterRow | undefined {
  const withArchived = qc?.getQueryData<IngredientMasterRow[]>(
    ingredientsMasterQuery(true).queryKey,
  );
  const activeOnly = qc?.getQueryData<IngredientMasterRow[]>(
    ingredientsMasterQuery(false).queryKey,
  );
  return withArchived?.find((m) => m.id === id) ?? activeOnly?.find((m) => m.id === id);
}

export type MealPlanEntry = Tables<"meal_plan_entries">;
export type IngredientMasterRow = Tables<"ingredients_master">;

export type FoodType = "recipe" | "ingredient" | "quick_entry";

export type MealPlanEntryFull = MealPlanEntry & {
  recipe:
    | (Recipe & {
        ingredients: IngredientWithMaster[];
        components?: RecipeComponentWithRelations[];
      })
    | null;
  ingredient: IngredientMasterRow | null;
};

/** Kompatibler Alias (früherer Name). */
export type MealPlanEntryWithRecipe = MealPlanEntryFull;

export type MacroTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  /** davon Zucker (informativ, nicht im Punktesystem). */
  sugar_g?: number;
};

export const MEAL_SLOTS = ["Frühstück", "Mittag", "Abend"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/** ISO-Datum (YYYY-MM-DD) in lokaler Zeitzone. */
/**
 * Nach einem Persist/Restore-Zyklus (IndexedDB) kommen Date-Objekte in
 * Mutation-Variablen als ISO-String zurück (JSON kennt kein Date) – diese
 * Hilfsfunktion macht daraus wieder ein echtes Date, egal was ankommt.
 */
export function asDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Montag der Woche, in der das Datum liegt. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // Mo = 0
  out.setDate(out.getDate() - dow);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

export function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function formatDayShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${formatDayShort(weekStart)} – ${formatDayShort(end)}`;
}

export function isToday(d: Date): boolean {
  return toISODate(d) === toISODate(new Date());
}

/** Erstellungszeit eines Eintrags als HH:MM, falls vorhanden. */
export function formatEntryTime(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------- Nährwerte */

type RecipeLike = Recipe & {
  ingredients?: IngredientWithMaster[];
  components?: RecipeComponentWithRelations[];
};

/**
 * Nährwerte pro Portion eines Rezepts – bei Komponenten-Rezepten die SUMME
 * aller Komponenten (siehe nutritionPerServing).
 */
export function recipeNutritionPerServing(
  recipe: RecipeLike | null | undefined,
  selection?: VariantSelection | null,
): MacroTotals | null {
  if (!recipe) return null;
  const per = nutritionPerServing(recipe, selection);
  if (per.calories == null) return null;
  const num = (v: number | null) => (v == null ? 0 : v);
  return {
    calories: per.calories,
    protein_g: num(per.protein_g),
    carbs_g: num(per.carbs_g),
    fat_g: num(per.fat_g),
    fiber_g: num(per.fiber_g),
    sugar_g: num(per.sugar_g),
  };
}

/** Nährwerte eines Lebensmittels für eine Menge in einer Einheit. */
export function foodMacros(
  master: IngredientMasterRow | null | undefined,
  amount: number | null,
  unit: string | null,
): MacroTotals | null {
  if (!master) return null;
  const c = computeNutritionFromMaster(master, amount, unit ?? master.unit);
  if (!c.convertible || c.calories == null) return null;
  const num = (v: number | null) => (v == null ? 0 : Number(v));
  return {
    calories: Number(c.calories),
    protein_g: num(c.protein_g),
    carbs_g: num(c.carbs_g),
    fat_g: num(c.fat_g),
    fiber_g: num(c.fiber_g),
    sugar_g: num(c.sugar_g),
  };
}

export function plannedServings(entry: MealPlanEntryFull): number {
  const planned = entry.servings != null ? Number(entry.servings) : (entry.recipe?.servings ?? 1);
  return planned > 0 ? planned : 1;
}

/** Nährwerte eines Schnelleintrags (Freitext-Mahlzeit). */
export function quickEntryMacros(entry: MealPlanEntryFull): MacroTotals | null {
  if (entry.quick_entry_calories == null) return null;
  const num = (v: number | null) => (v == null ? 0 : Number(v));
  return {
    calories: Number(entry.quick_entry_calories),
    protein_g: num(entry.quick_entry_protein_g),
    carbs_g: num(entry.quick_entry_carbs_g),
    fat_g: num(entry.quick_entry_fat_g),
    fiber_g: num(entry.quick_entry_fiber_g),
    sugar_g: num(entry.quick_entry_sugar_g),
  };
}

/**
 * Live berechnete Nährwerte (aktueller Rezept-/Zutaten-Stand).
 * Nur für Vergleich/Neuberechnung beim Bearbeiten – NICHT für die Anzeige.
 */
export function liveEntryMacros(entry: MealPlanEntryFull): MacroTotals | null {
  if (entry.food_type === "quick_entry") return quickEntryMacros(entry);
  if (entry.food_type === "ingredient") {
    return foodMacros(
      entry.ingredient,
      entry.amount != null ? Number(entry.amount) : null,
      entry.unit,
    );
  }
  const per = recipeNutritionPerServing(
    entry.recipe,
    parseVariantSelection(entry.selected_variant_ids),
  );
  if (!per) return null;
  const f = plannedServings(entry);
  return {
    calories: per.calories * f,
    protein_g: per.protein_g * f,
    carbs_g: per.carbs_g * f,
    fat_g: per.fat_g * f,
    fiber_g: per.fiber_g * f,
    sugar_g: (per.sugar_g ?? 0) * f,
  };
}

/**
 * Nährwerte eines geplanten Eintrags. Es gilt der Snapshot vom Zeitpunkt des
 * Einplanens; nur Alt-Einträge ohne Snapshot fallen auf die Live-Berechnung zurück.
 */
export function entryMacros(entry: MealPlanEntryFull): MacroTotals | null {
  // Ausgelassene Einträge tragen zu Nährwerten/Punkten/Streak nichts bei,
  // bleiben aber als Eintrag sichtbar (siehe MealPlanEntryPatch/"skipped").
  if (entry.skipped) return null;
  if (entry.snapshot_calories != null) {
    const num = (v: number | null) => (v == null ? 0 : Number(v));
    return {
      calories: Number(entry.snapshot_calories),
      protein_g: num(entry.snapshot_protein_g),
      carbs_g: num(entry.snapshot_carbs_g),
      fat_g: num(entry.snapshot_fat_g),
      fiber_g: num(entry.snapshot_fiber_g),
      sugar_g: num(entry.snapshot_sugar_g),
    };
  }
  return liveEntryMacros(entry);
}

export function entryKcal(entry: MealPlanEntryFull): number | null {
  return entryMacros(entry)?.calories ?? null;
}

export function entryTitle(entry: MealPlanEntryFull): string {
  if (entry.snapshot_name) return entry.snapshot_name;
  if (entry.food_type === "quick_entry") return entry.quick_entry_name ?? "Schnelleintrag";
  if (entry.food_type === "ingredient") return entry.ingredient?.name ?? "Lebensmittel";
  return entry.recipe?.title ?? "Rezept";
}

/**
 * Weicht der aktuelle Rezept-/Zutaten-Stand vom gespeicherten Snapshot ab?
 * (Für den Hinweis „seitdem bearbeitet".)
 */
export function entryDiffersFromSnapshot(entry: MealPlanEntryFull): boolean {
  if (entry.snapshot_calories == null) return false;
  const live = liveEntryMacros(entry);
  if (!live) return false;
  return Math.abs(live.calories - Number(entry.snapshot_calories)) > 1;
}

export function entryImageUrl(entry: MealPlanEntryFull): string | null {
  if (entry.food_type === "quick_entry") return null;
  return entry.food_type === "ingredient"
    ? (entry.ingredient?.image_url ?? null)
    : (entry.recipe?.image_url ?? null);
}

/** Kurzbeschreibung der Menge, z.B. "2 P.", "350 g" oder "150 g". */
export function entryAmountLabel(entry: MealPlanEntryFull): string | null {
  if (entry.food_type === "quick_entry") return "Schnelleintrag";
  if (entry.food_type === "ingredient") {
    if (entry.amount == null) return null;
    return `${Number(entry.amount)} ${entry.unit ?? entry.ingredient?.unit ?? ""}`.trim();
  }
  // In Gramm eingeplant → auch in Gramm anzeigen.
  if (entry.input_mode === "grams" && entry.input_grams_value != null) {
    return `${Math.round(Number(entry.input_grams_value))} g`;
  }
  const planned =
    entry.servings != null ? Number(entry.servings) : (entry.recipe?.servings ?? null);
  if (planned == null) return null;
  return `${planned % 1 === 0 ? planned : planned.toFixed(2)} P.`;
}

/** Kategorie des Eintrags (für Farbstreifen); null bei Schnelleinträgen. */
export function entryCategory(entry: MealPlanEntryFull): string | null {
  if (entry.food_type === "quick_entry") return null;
  if (entry.food_type === "ingredient") return entry.ingredient?.category ?? null;
  return entry.recipe?.categories?.[0] ?? null;
}

/** Gewählte Variante bzw. Sorte, z.B. "Penne" oder "Haselnuss". */
export function entryVariantTag(entry: MealPlanEntryFull): string | null {
  const parts: string[] = [];
  if (entry.snapshot_variant_label) parts.push(entry.snapshot_variant_label);
  const ids = Object.values(parseGroupChoices(entry.group_choices));
  if (ids.length > 0) {
    const names = new Set<string>();
    for (const ing of entry.recipe?.ingredients ?? []) {
      const master = ing.master;
      if (master && ids.includes(master.id)) names.add(master.name);
    }
    for (const n of names) if (!parts.includes(n)) parts.push(n);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/* -------------------------------------------------------------------- Daten */

const ENTRY_SELECT =
  "*, recipe:recipes(*, ingredients(*, master:ingredients_master(*))), ingredient:ingredients_master(*)";

export async function fetchMealPlan(from: string, to: string): Promise<MealPlanEntryFull[]> {
  // Explizit seitenweise laden: Die Backend-API begrenzt große Resultsets,
  // wodurch ein längerer Zeitraum sonst unbemerkt nur teilweise ankommt.
  const pageSize = 500;
  const entries: MealPlanEntryFull[] = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("meal_plan_entries")
      .select(ENTRY_SELECT)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true })
      .order("meal_slot", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as MealPlanEntryFull[];
    entries.push(...page);
    if (page.length < pageSize) break;
  }

  // Komponenten-Rezepte brauchen ihre Komponenten (inkl. verlinkter Rezepte),
  // sonst fehlen deren Nährwerte in der Tagessumme.
  const needsComponents = entries.some((e) => e.recipe != null);
  if (!needsComponents) return entries;
  const nodes = await fetchRecipes();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return entries.map((e) =>
    e.recipe && byId.has(e.recipe.id)
      ? { ...e, recipe: { ...e.recipe, ...byId.get(e.recipe.id)! } }
      : e,
  );
}

export const mealPlanQuery = (weekStart: Date) => {
  const from = toISODate(weekStart);
  const to = toISODate(addDays(weekStart, 6));
  return queryOptions({
    queryKey: ["meal-plan", from],
    queryFn: () => fetchMealPlan(from, to),
  });
};

/** Eine Zutat im festgeschriebenen Snapshot eines Eintrags. */
export type SnapshotIngredient = {
  name: string;
  component: string | null;
  amount: number | null;
  unit: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
};

type SnapshotFields = {
  snapshot_name: string;
  snapshot_calories: number | null;
  snapshot_protein_g: number | null;
  snapshot_carbs_g: number | null;
  snapshot_fat_g: number | null;
  snapshot_fiber_g: number | null;
  snapshot_sugar_g: number | null;
  snapshot_variant_label: string | null;
  snapshot_ingredients: SnapshotIngredient[] | null;
};

function snapshotFrom(
  name: string,
  m: MacroTotals | null,
  extra?: { variantLabel?: string | null; ingredients?: SnapshotIngredient[] | null },
): SnapshotFields {
  return {
    snapshot_name: name,
    snapshot_calories: m ? Math.round(m.calories * 10) / 10 : null,
    snapshot_protein_g: m ? Math.round(m.protein_g * 10) / 10 : null,
    snapshot_carbs_g: m ? Math.round(m.carbs_g * 10) / 10 : null,
    snapshot_fat_g: m ? Math.round(m.fat_g * 10) / 10 : null,
    snapshot_fiber_g: m ? Math.round(m.fiber_g * 10) / 10 : null,
    snapshot_sugar_g: m ? Math.round((m.sugar_g ?? 0) * 10) / 10 : null,
    snapshot_variant_label: extra?.variantLabel ?? null,
    snapshot_ingredients: extra?.ingredients ?? null,
  };
}

/** Bezeichnung der gewählten Varianten, z.B. "Haselnuss, Vollkorn". */
function variantLabelOf(
  components: RecipeComponentWithRelations[] | undefined,
  selection?: VariantSelection | null,
): string | null {
  const labels: string[] = [];
  for (const c of components ?? []) {
    if (!isChoiceComponent(c)) continue;
    const vid = selectedVariantId(c, selection ?? null);
    const label = (c.variants ?? []).find((v) => v.id === vid)?.label;
    if (label) labels.push(label);
  }
  return labels.length > 0 ? labels.join(", ") : null;
}

const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);

/**
 * Finale Zutatenliste eines Rezepts für die geplante Portionsanzahl –
 * über alle Komponenten flach zusammengeführt.
 */
function snapshotIngredientsOf(
  recipe: RecipeNode,
  factor: number,
  selection?: VariantSelection | null,
): SnapshotIngredient[] {
  const out: SnapshotIngredient[] = [];
  const push = (
    rows: ReturnType<typeof resolveIngredients>,
    component: string | null,
    f: number,
  ) => {
    for (const ing of rows) {
      out.push({
        name: ing.name,
        component,
        amount: round1(ing.amount == null ? null : ing.amount * f),
        unit: ing.unit,
        calories: round1(ing.calories == null ? null : ing.calories * f),
        protein_g: round1(ing.protein_g == null ? null : ing.protein_g * f),
        carbs_g: round1(ing.carbs_g == null ? null : ing.carbs_g * f),
        fat_g: round1(ing.fat_g == null ? null : ing.fat_g * f),
        fiber_g: round1(ing.fiber_g == null ? null : ing.fiber_g * f),
        sugar_g: round1(ing.sugar_g == null ? null : ing.sugar_g * f),
      });
    }
  };
  const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
  push(resolveIngredients(freeIngredients(recipe)), null, factor / servings);
  for (const c of recipe.components ?? []) {
    if (c.linked_recipe_id) {
      const linked = c.linked;
      if (!linked) continue;
      const ls = linked.servings && linked.servings > 0 ? linked.servings : 1;
      push(
        resolveIngredients(freeIngredients(linked)),
        c.name,
        (factor * (c.servings && c.servings > 0 ? c.servings : 1)) / ls,
      );
      continue;
    }
    const cs = c.servings && c.servings > 0 ? c.servings : 1;
    push(
      resolveIngredients(effectiveComponentIngredients(c, selection ?? null)),
      c.name,
      factor / cs,
    );
  }
  return out;
}

/** Snapshot für ein Rezept (Nährwerte pro Portion × geplante Portionen). */
export async function recipeSnapshot(
  recipeId: string,
  servings: number | null,
  selection?: VariantSelection | null,
  groupChoices?: GroupChoices | null,
  qc?: QueryClient,
): Promise<SnapshotFields> {
  const cached = cachedRecipe(qc, recipeId);
  const loaded = cached ? (cached as unknown as RecipeWithRelations) : await fetchRecipe(recipeId);
  const recipe =
    groupChoices && Object.keys(groupChoices).length > 0
      ? applyGroupChoices(
          loaded,
          groupChoices,
          await fetchMastersByIds(Object.values(groupChoices), qc),
        )
      : loaded;
  const per = recipeNutritionPerServing(recipe, selection ?? null);
  const f = servings != null && servings > 0 ? servings : (recipe.servings ?? 1);
  const m = per
    ? {
        calories: per.calories * f,
        protein_g: per.protein_g * f,
        carbs_g: per.carbs_g * f,
        fat_g: per.fat_g * f,
        fiber_g: per.fiber_g * f,
        sugar_g: (per.sugar_g ?? 0) * f,
      }
    : null;
  return snapshotFrom(recipe.title, m, {
    variantLabel: variantLabelOf(recipe.components, selection ?? null),
    ingredients: snapshotIngredientsOf(recipe, f, selection ?? null),
  });
}

/** Snapshot-Zutaten robust aus dem gespeicherten JSON lesen. */
export function parseSnapshotIngredients(value: unknown): SnapshotIngredient[] {
  if (!Array.isArray(value)) return [];
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return value
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      name: typeof r.name === "string" ? r.name : "Zutat",
      component: typeof r.component === "string" ? r.component : null,
      amount: num(r.amount),
      unit: typeof r.unit === "string" ? r.unit : null,
      calories: num(r.calories),
      protein_g: num(r.protein_g),
      carbs_g: num(r.carbs_g),
      fat_g: num(r.fat_g),
      fiber_g: num(r.fiber_g),
      sugar_g: num(r.sugar_g),
    }));
}

/** Gespeicherte Sorten-Auswahl eines Eintrags lesen. */
export function parseGroupChoices(value: unknown): GroupChoices {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: GroupChoices = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** Stammzutaten der gewählten Sorten laden (für Produktgruppen). */
export async function fetchMastersByIds(
  ids: string[],
  qc?: QueryClient,
): Promise<IngredientMasterRow[]> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return [];
  const fromCache = unique
    .map((id) => cachedMaster(qc, id))
    .filter((m): m is IngredientMasterRow => !!m);
  if (fromCache.length === unique.length) return fromCache;
  try {
    const { data, error } = await supabase.from("ingredients_master").select("*").in("id", unique);
    if (error) throw error;
    return (data ?? []) as IngredientMasterRow[];
  } catch (err) {
    if (fromCache.length > 0) return fromCache; // offline, zumindest teilweise im Cache
    throw err;
  }
}

/** Snapshot für ein Lebensmittel (Menge × Nährwerte der Stammzutat). */
export async function foodSnapshot(
  ingredientMasterId: string,
  amount: number,
  unit: string,
  qc?: QueryClient,
): Promise<SnapshotFields> {
  const cached = cachedMaster(qc, ingredientMasterId);
  const { data, error } = cached
    ? { data: cached, error: null }
    : await supabase
        .from("ingredients_master")
        .select("*")
        .eq("id", ingredientMasterId)
        .maybeSingle();
  if (error) throw error;
  const master = data as IngredientMasterRow | null;
  return snapshotFrom(master?.name ?? "Lebensmittel", foodMacros(master, amount, unit));
}

export async function addRecipeEntry(input: {
  userId: string;
  date: string;
  meal_slot: MealSlot;
  recipe_id: string;
  servings: number | null;
  sort_order?: number;
  selected_variant_ids?: VariantSelection | null;
  group_choices?: GroupChoices | null;
  /** Wurde die Menge in Portionen oder Gramm eingegeben? */
  input_mode?: "servings" | "grams";
  input_grams_value?: number | null;
  /** Batch-Verknüpfung (Vorkochen für mehrere Tage). */
  batch_group_id?: string | null;
  batch_role?: "none" | "start" | "leftover";
  /** Koch-Tag der Batch-Gruppe – unabhängig von den Verzehrtagen. */
  batch_cook_date?: string | null;
  qc?: QueryClient;
}) {
  const snapshot = await recipeSnapshot(
    input.recipe_id,
    input.servings,
    input.selected_variant_ids ?? null,
    input.group_choices ?? null,
    input.qc,
  );
  const { error } = await supabase.from("meal_plan_entries").insert({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    user_id: input.userId,
    date: input.date,
    meal_slot: input.meal_slot,
    food_type: "recipe",
    recipe_id: input.recipe_id,
    servings: input.servings,
    sort_order: input.sort_order ?? 0,
    selected_variant_ids: input.selected_variant_ids ?? null,
    group_choices: input.group_choices ?? null,
    input_mode: input.input_mode ?? "servings",
    input_grams_value: input.input_grams_value ?? null,
    batch_group_id: input.batch_group_id ?? null,
    batch_role: input.batch_role ?? "none",
    batch_cook_date: input.batch_cook_date ?? null,
    ...snapshot,
  });
  if (error) throw error;
}

export async function addFoodEntry(input: {
  userId: string;
  date: string;
  meal_slot: MealSlot;
  ingredient_master_id: string;
  amount: number;
  unit: string;
  sort_order?: number;
  qc?: QueryClient;
}) {
  const snapshot = await foodSnapshot(
    input.ingredient_master_id,
    input.amount,
    input.unit,
    input.qc,
  );
  const { error } = await supabase.from("meal_plan_entries").insert({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    user_id: input.userId,
    date: input.date,
    meal_slot: input.meal_slot,
    food_type: "ingredient",
    ingredient_master_id: input.ingredient_master_id,
    amount: input.amount,
    unit: input.unit,
    sort_order: input.sort_order ?? 0,
    ...snapshot,
  });
  if (error) throw error;
}

export async function addQuickEntry(input: {
  userId: string;
  date: string;
  meal_slot: MealSlot;
  name: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sort_order?: number;
}) {
  const { error } = await supabase.from("meal_plan_entries").insert({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    user_id: input.userId,
    date: input.date,
    meal_slot: input.meal_slot,
    food_type: "quick_entry",
    quick_entry_name: input.name,
    quick_entry_calories: input.calories,
    quick_entry_protein_g: input.protein_g,
    quick_entry_carbs_g: input.carbs_g,
    quick_entry_fat_g: input.fat_g,
    quick_entry_fiber_g: input.fiber_g ?? null,
    quick_entry_sugar_g: input.sugar_g ?? null,
    sort_order: input.sort_order ?? 0,
    snapshot_name: input.name,
    snapshot_calories: input.calories,
    snapshot_protein_g: input.protein_g,
    snapshot_carbs_g: input.carbs_g,
    snapshot_fat_g: input.fat_g,
    snapshot_fiber_g: input.fiber_g ?? null,
    snapshot_sugar_g: input.sugar_g ?? null,
  });
  if (error) throw error;
}

/**
 * Kopiert einen bestehenden Eintrag auf ein anderes Datum/Slot.
 * Es wird ein neuer Datensatz mit frischem Nährwert-Snapshot angelegt
 * (gleiche recipe_id / ingredient_master_id), ohne Batch-Verknüpfung.
 */
export async function copyMealPlanEntry(input: {
  entry: MealPlanEntryFull;
  userId: string;
  date: string;
  meal_slot: MealSlot;
  sort_order?: number;
  qc?: QueryClient;
}) {
  const { entry } = input;
  if (entry.food_type === "recipe" && entry.recipe_id) {
    await addRecipeEntry({
      userId: input.userId,
      date: input.date,
      meal_slot: input.meal_slot,
      recipe_id: entry.recipe_id,
      servings: entry.servings != null ? Number(entry.servings) : null,
      sort_order: input.sort_order ?? 0,
      selected_variant_ids: parseVariantSelection(entry.selected_variant_ids),
      group_choices: entry.group_choices as GroupChoices | null,
      input_mode: (entry.input_mode as "servings" | "grams") ?? "servings",
      input_grams_value: entry.input_grams_value != null ? Number(entry.input_grams_value) : null,
      qc: input.qc,
    });
    return;
  }
  if (entry.food_type === "ingredient" && entry.ingredient_master_id) {
    await addFoodEntry({
      userId: input.userId,
      date: input.date,
      meal_slot: input.meal_slot,
      ingredient_master_id: entry.ingredient_master_id,
      amount: entry.amount != null ? Number(entry.amount) : 0,
      unit: entry.unit ?? entry.ingredient?.unit ?? "g",
      sort_order: input.sort_order ?? 0,
      qc: input.qc,
    });
    return;
  }
  await addQuickEntry({
    userId: input.userId,
    date: input.date,
    meal_slot: input.meal_slot,
    name: entry.quick_entry_name ?? entry.snapshot_name ?? "Schnelleintrag",
    calories: Number(entry.quick_entry_calories ?? entry.snapshot_calories ?? 0),
    protein_g: entry.quick_entry_protein_g != null ? Number(entry.quick_entry_protein_g) : null,
    carbs_g: entry.quick_entry_carbs_g != null ? Number(entry.quick_entry_carbs_g) : null,
    fat_g: entry.quick_entry_fat_g != null ? Number(entry.quick_entry_fat_g) : null,
    fiber_g: entry.quick_entry_fiber_g != null ? Number(entry.quick_entry_fiber_g) : null,
    sugar_g: entry.quick_entry_sugar_g != null ? Number(entry.quick_entry_sugar_g) : null,
    sort_order: input.sort_order ?? 0,
  });
}

export type MealPlanEntryPatch = Partial<
  Pick<
    MealPlanEntry,
    | "servings"
    | "amount"
    | "unit"
    | "date"
    | "meal_slot"
    | "skipped"
    | "quick_entry_name"
    | "quick_entry_calories"
    | "quick_entry_protein_g"
    | "quick_entry_carbs_g"
    | "quick_entry_fat_g"
    | "quick_entry_fiber_g"
    | "quick_entry_sugar_g"
    | "selected_variant_ids"
    | "group_choices"
    | "input_mode"
    | "input_grams_value"
    | "snapshot_name"
    | "snapshot_calories"
    | "snapshot_protein_g"
    | "snapshot_carbs_g"
    | "snapshot_fat_g"
    | "snapshot_fiber_g"
    | "snapshot_sugar_g"
    | "snapshot_variant_label"
    | "snapshot_ingredients"
  >
>;

/**
 * Snapshot neu berechnen, wenn der Nutzer den Eintrag selbst ändert
 * (Portionen, Menge, Variante, Schnelleintrag-Werte).
 */
export async function snapshotForPatch(
  entry: MealPlanEntryFull,
  patch: MealPlanEntryPatch,
  qc?: QueryClient,
): Promise<SnapshotFields | null> {
  if (entry.food_type === "quick_entry") {
    if (patch.quick_entry_calories === undefined && patch.quick_entry_name === undefined) {
      return null;
    }
    const num = (v: unknown) => (v == null ? null : Number(v));
    return {
      snapshot_name: patch.quick_entry_name ?? entry.quick_entry_name ?? "Schnelleintrag",
      snapshot_calories: num(patch.quick_entry_calories ?? entry.quick_entry_calories),
      snapshot_protein_g: num(patch.quick_entry_protein_g ?? entry.quick_entry_protein_g),
      snapshot_carbs_g: num(patch.quick_entry_carbs_g ?? entry.quick_entry_carbs_g),
      snapshot_fat_g: num(patch.quick_entry_fat_g ?? entry.quick_entry_fat_g),
      snapshot_fiber_g: num(patch.quick_entry_fiber_g ?? entry.quick_entry_fiber_g),
      snapshot_sugar_g: num(patch.quick_entry_sugar_g ?? entry.quick_entry_sugar_g),
      snapshot_variant_label: null,
      snapshot_ingredients: null,
    };
  }
  if (entry.food_type === "ingredient") {
    if (patch.amount === undefined && patch.unit === undefined) return null;
    const amount = Number(patch.amount ?? entry.amount ?? 0);
    const unit = patch.unit ?? entry.unit ?? entry.ingredient?.unit ?? "g";
    if (!entry.ingredient_master_id || amount <= 0) return null;
    return foodSnapshot(entry.ingredient_master_id, amount, unit, qc);
  }
  if (
    patch.servings === undefined &&
    patch.selected_variant_ids === undefined &&
    patch.group_choices === undefined
  ) {
    return null;
  }
  if (!entry.recipe_id) return null;
  const servings =
    patch.servings != null
      ? Number(patch.servings)
      : entry.servings != null
        ? Number(entry.servings)
        : null;
  const selection = parseVariantSelection(patch.selected_variant_ids ?? entry.selected_variant_ids);
  const choices = parseGroupChoices(patch.group_choices ?? entry.group_choices);
  return recipeSnapshot(entry.recipe_id, servings, selection, choices, qc);
}

export async function updateMealPlanEntry(id: string, patch: MealPlanEntryPatch) {
  const { error } = await supabase.from("meal_plan_entries").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteMealPlanEntry(id: string) {
  const { error } = await supabase.from("meal_plan_entries").delete().eq("id", id);
  if (error) throw error;
}
