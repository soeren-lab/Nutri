import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseVariantSelection } from "@/lib/variants";
import {
  addDays,
  addRecipeEntry,
  parseGroupChoices,
  plannedServings,
  toISODate,
  type MealPlanEntryFull,
  type MealSlot,
} from "@/lib/meal-plan";


/** Rolle eines Eintrags innerhalb einer Batch-Gruppe (Vorkochen). */
export type BatchRole = "none" | "start" | "leftover";

type BatchRecipeLike = {
  is_fixed_batch?: boolean | null;
  batch_servings?: number | string | null;
  servings?: number | null;
};

export function batchRoleOf(entry: { batch_role?: string | null }): BatchRole {
  return entry.batch_role === "start" || entry.batch_role === "leftover"
    ? entry.batch_role
    : "none";
}

export function isBatchStart(entry: { batch_role?: string | null }): boolean {
  return batchRoleOf(entry) === "start";
}

export function isBatchLeftover(entry: { batch_role?: string | null }): boolean {
  return batchRoleOf(entry) === "leftover";
}

export function isBatched(entry: {
  batch_role?: string | null;
  batch_group_id?: string | null;
}): boolean {
  return !!entry.batch_group_id && batchRoleOf(entry) !== "none";
}

/** Rezept ist eine feste Charge (z.B. Auflaufform) und nicht frei teilbar. */
export function isFixedBatch(recipe: BatchRecipeLike | null | undefined): boolean {
  return !!recipe?.is_fixed_batch;
}

/** Portionen einer ganzen Form/Charge (Fallback: Rezept-Portionen). */
export function batchFormSize(recipe: BatchRecipeLike | null | undefined): number {
  const raw = recipe?.batch_servings != null ? Number(recipe.batch_servings) : null;
  if (raw != null && raw > 0) return raw;
  const s = recipe?.servings != null ? Number(recipe.servings) : null;
  return s != null && s > 0 ? s : 1;
}

/** Ganze Formen, die für eine Portionsmenge gebacken werden müssen. */
export function formsForServings(servings: number, formSize: number): number {
  if (formSize <= 0) return 1;
  return Math.max(1, Math.ceil(Math.round((servings / formSize) * 1000) / 1000));
}

/** Auf ganze Formen aufgerundete Portionsmenge (Einkauf/Zubereitung). */
export function fixedBatchServings(servings: number, formSize: number): number {
  return formsForServings(servings, formSize) * formSize;
}

/**
 * Verknüpft einen bestehenden Rezept-Eintrag mit weiteren Verzehrtagen.
 * Der Koch-Tag (`cookDate`) ist völlig frei wählbar und muss kein Tag sein,
 * an dem auch eine Portion gegessen wird.
 */
export async function createBatch(input: {
  entry: MealPlanEntryFull;
  userId: string;
  targets: Array<{ date: string; slot: MealSlot }>;
  servingsPerDay: number;
  cookDate: string;
}): Promise<string> {
  const { entry, userId, targets, servingsPerDay, cookDate } = input;
  if (entry.food_type !== "recipe" || !entry.recipe_id) {
    throw new Error("Nur Rezepte können vorgekocht werden");
  }
  const groupId = entry.batch_group_id ?? crypto.randomUUID();
  // Verzehrtage der Gruppe – der Koch-Tag muss keiner davon sein.
  const eatingDates = Array.from(new Set([entry.date, ...targets.map((t) => t.date)])).sort();
  // „start" (Koch-Tag-Badge) nur, wenn der Eintrag tatsächlich am Koch-Tag
  // liegt – alle anderen Verzehrtage sind immer „Vorgekocht".
  const roleFor = (date: string): BatchRole => (date === cookDate ? "start" : "leftover");

  const { error } = await supabase
    .from("meal_plan_entries")
    .update({
      batch_group_id: groupId,
      batch_role: roleFor(entry.date),
      batch_cook_date: cookDate,
    })
    .eq("id", entry.id);
  if (error) throw error;

  const selection = parseVariantSelection(entry.selected_variant_ids);
  const choices = parseGroupChoices(entry.group_choices);

  // Beim Bearbeiten einer bestehenden Gruppe: vorhandene Einträge entweder
  // aktualisieren (wenn weiterhin gewünscht) oder sauber entkoppeln.
  const remainingTargets = [...targets];
  if (entry.batch_group_id) {
    const { data: existing, error: exErr } = await supabase
      .from("meal_plan_entries")
      .select("id, date, meal_slot")
      .eq("batch_group_id", groupId)
      .neq("id", entry.id);
    if (exErr) throw exErr;
    for (const row of existing ?? []) {
      const idx = remainingTargets.findIndex(
        (t) => t.date === row.date && t.slot === row.meal_slot,
      );
      if (idx >= 0) {
        remainingTargets.splice(idx, 1);
        const { error: upErr } = await supabase
          .from("meal_plan_entries")
          .update({
            batch_group_id: groupId,
            batch_role: roleFor(row.date),
            batch_cook_date: cookDate,
          })
          .eq("id", row.id);
        if (upErr) throw upErr;
      } else {
        const { error: clrErr } = await supabase
          .from("meal_plan_entries")
          .update({ batch_group_id: null, batch_role: "none", batch_cook_date: null })
          .eq("id", row.id);
        if (clrErr) throw clrErr;
      }
    }
  }

  for (const t of remainingTargets) {
    await addRecipeEntry({
      userId,
      date: t.date,
      meal_slot: t.slot,
      recipe_id: entry.recipe_id,
      servings: servingsPerDay,
      selected_variant_ids: Object.keys(selection).length > 0 ? selection : null,
      group_choices: Object.keys(choices).length > 0 ? choices : null,
      batch_group_id: groupId,
      batch_role: roleFor(t.date),
      batch_cook_date: cookDate,
    });
  }
  await cleanupBatchGroup(groupId);
  return groupId;
}

/**
 * Räumt eine Batch-Gruppe auf: bleibt nur noch ein Eintrag übrig oder fehlt der
 * Koch-Tag, werden alle Batch-Felder gelöscht – so bleiben keine Geister-Badges
 * an anderen Tagen stehen.
 */
export async function cleanupBatchGroup(groupId: string | null | undefined): Promise<void> {
  if (!groupId) return;
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("id, date, batch_role, batch_cook_date")
    .eq("batch_group_id", groupId)
    .order("date", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return;
  const cookDate = rows.find((r) => r.batch_cook_date)?.batch_cook_date ?? null;
  if (rows.length < 2 || !cookDate) {
    await dissolveBatch(groupId);
    return;
  }
  // Gruppe ist gültig: fehlende/ungültige Start-Rolle reparieren, statt die
  // Verknüpfung (und damit alle „Vorgekocht"-Badges) zu verwerfen.
  const starts = rows.filter((r) => r.batch_role === "start");
  // Koch-Tag liegt auf einem Verzehrtag → genau dieser ist „start".
  const startRow = rows.find((r) => r.date === cookDate) ?? null;
  if (startRow && starts.length === 1 && starts[0].id === startRow.id) return;
  if (!startRow && starts.length === 0) return;
  for (const row of rows) {
    const role = startRow && row.id === startRow.id ? "start" : "leftover";
    if (row.batch_role === role) continue;
    const { error: upErr } = await supabase
      .from("meal_plan_entries")
      .update({ batch_role: role, batch_cook_date: cookDate })
      .eq("id", row.id);
    if (upErr) throw upErr;
  }
}


/** Gesamtzeit eines Rezepts (Vorbereitung + Kochzeit) in Minuten. */
export function recipeTotalMinutes(
  recipe: { prep_time_minutes?: number | null; cook_time_minutes?: number | null } | null | undefined,
): number | null {
  const prep = recipe?.prep_time_minutes ?? null;
  const cook = recipe?.cook_time_minutes ?? null;
  if (prep == null && cook == null) return null;
  return (prep ?? 0) + (cook ?? 0);
}

export type BatchCookSummary = {
  groupId: string;
  title: string;
  /** Rezept-ID für die Koch-Ansicht (falls vorhanden). */
  recipeId: string | null;
  totalMinutes: number | null;
  totalServings: number;
  /** Verzehrtage (ISO) der Gruppe, aufsteigend sortiert. */
  dates: string[];
  /** Tage nach dem Koch-Tag, die von diesem Batch abgedeckt sind. */
  followUpDays: number;
  /** Bereits abgehakt (Zeitpunkt) oder null. */
  cookedAt: string | null;
  /** Variantenauswahl des ersten Eintrags (für exakte Zutaten). */
  selectedVariantIds: unknown;
  groupChoices: unknown;
};

/**
 * Batch-Gruppen, für die am angegebenen Tag gekocht wird – inklusive
 * Gesamtzeit und Reichweite (Folgetage/Portionen).
 */
export function batchCookSummaries(
  entries: MealPlanEntryFull[],
  cookIso: string,
): BatchCookSummary[] {
  const groups = new Map<string, MealPlanEntryFull[]>();
  for (const e of entries) {
    if (!e.batch_group_id || e.batch_cook_date !== cookIso) continue;
    const list = groups.get(e.batch_group_id) ?? [];
    list.push(e);
    groups.set(e.batch_group_id, list);
  }

  return Array.from(groups.entries()).map(([groupId, list]) => {
    const dates = Array.from(new Set(list.map((e) => e.date))).sort();
    const withRecipe = list.find((e) => e.recipe) ?? list[0];
    const recipe = withRecipe?.recipe ?? null;
    const totalServings = list.reduce((sum, e) => sum + plannedServings(e), 0);
    const cooked = list.find((e) => (e as { batch_cooked_at?: string | null }).batch_cooked_at);
    return {
      groupId,
      title: recipe?.title ?? list[0]?.snapshot_name ?? "Vorkochen",
      recipeId: withRecipe?.recipe_id ?? null,
      totalMinutes: recipeTotalMinutes(recipe),
      totalServings: Math.round(totalServings * 10) / 10,
      dates,
      followUpDays: dates.filter((d) => d > cookIso).length,
      cookedAt: (cooked as { batch_cooked_at?: string | null } | undefined)?.batch_cooked_at ?? null,
      selectedVariantIds: withRecipe?.selected_variant_ids ?? null,
      groupChoices: withRecipe?.group_choices ?? null,
    };
  });
}

/** Batch-Gruppe als gekocht markieren bzw. Häkchen entfernen. */
export async function setBatchCooked(groupId: string, cooked: boolean): Promise<void> {
  const { error } = await supabase
    .from("meal_plan_entries")
    .update({ batch_cooked_at: cooked ? new Date().toISOString() : null })
    .eq("batch_group_id", groupId);
  if (error) throw error;
}


/**
 * Alle Batch-Einträge, deren Koch-Tag im Zeitraum liegt – unabhängig davon, in
 * welcher Woche die Verzehrtage liegen. Nur so erscheint die Koch-Kachel auch,
 * wenn für eine Folgewoche vorgekocht wird.
 */
export async function fetchBatchCookEntries(
  from: string,
  to: string,
): Promise<MealPlanEntryFull[]> {
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("*, recipe:recipes(*)")
    .not("batch_group_id", "is", null)
    .gte("batch_cook_date", from)
    .lte("batch_cook_date", to);
  if (error) throw error;
  return (data ?? []) as unknown as MealPlanEntryFull[];
}

export const batchCookWeekQuery = (weekStart: Date) => {
  const from = toISODate(weekStart);
  const to = toISODate(addDays(weekStart, 6));
  return queryOptions({
    queryKey: ["batch-cook-week", from],
    queryFn: () => fetchBatchCookEntries(from, to),
  });
};




/** Batch-Verknüpfung lösen – die Einträge selbst bleiben erhalten. */
export async function dissolveBatch(groupId: string): Promise<void> {
  const { error } = await supabase
    .from("meal_plan_entries")
    .update({ batch_group_id: null, batch_role: "none", batch_cook_date: null })
    .eq("batch_group_id", groupId);
  if (error) throw error;
}

/**
 * Gesamt-Portionen je Batch-Gruppe (über alle Tage, auch außerhalb des
 * betrachteten Zeitraums) – die volle Menge wird am Koch-Tag eingekauft.
 */
export async function fetchBatchGroupServings(
  groupIds: string[],
): Promise<Map<string, number>> {
  const unique = Array.from(new Set(groupIds));
  const out = new Map<string, number>();
  if (unique.length === 0) return out;
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("batch_group_id, servings, recipe_id, recipes(servings)")
    .in("batch_group_id", unique);
  if (error) throw error;
  for (const row of data ?? []) {
    const gid = row.batch_group_id;
    if (!gid) continue;
    const fallback = (row as { recipes?: { servings: number | null } | null }).recipes?.servings;
    const raw = row.servings != null ? Number(row.servings) : (fallback ?? 1);
    out.set(gid, (out.get(gid) ?? 0) + (raw > 0 ? raw : 1));
  }
  return out;
}

/** Portionen eines Eintrags (für die Batch-Anzeige). */
export function entryServings(entry: MealPlanEntryFull): number {
  return plannedServings(entry);
}
