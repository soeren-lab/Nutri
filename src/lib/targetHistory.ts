import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  computeTargets,
  fetchUserProfile,
  recommendedFiber,
  SUGAR_MAX_DEFAULT_G,
  type NutritionTargets,
} from "@/lib/nutritionTargets";

export type TargetHistoryRow = Tables<"target_history">;

/** Auflöser: liefert die am jeweiligen Datum gültigen Ziel-Werte. */
export type TargetsForDate = (dateIso: string) => NutritionTargets | null;

function toISODateLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function isoOf(date: Date | string): string {
  return typeof date === "string" ? date : toISODateLocal(date);
}

function rowToTargets(row: TargetHistoryRow): NutritionTargets | null {
  const calories = row.target_calories != null ? Number(row.target_calories) : 0;
  if (!calories) return null;
  return {
    bmr: 0,
    tdee: 0,
    calories: Math.round(calories),
    protein_g: Math.round(Number(row.target_protein_g ?? 0)),
    carbs_g: Math.round(Number(row.target_carbs_g ?? 0)),
    fat_g: Math.round(Number(row.target_fat_g ?? 0)),
    fiber_g:
      row.target_fiber_g != null
        ? Math.round(Number(row.target_fiber_g))
        : recommendedFiber(calories),
    sugar_max_g:
      row.target_sugar_max_g != null
        ? Math.round(Number(row.target_sugar_max_g))
        : SUGAR_MAX_DEFAULT_G,
    manual: true,
  };
}

/** Komplette Ziel-Historie (aufsteigend nach valid_from). */
export async function fetchTargetHistory(): Promise<TargetHistoryRow[]> {
  const { data, error } = await supabase
    .from("target_history")
    .select("*")
    .order("valid_from", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export const targetHistoryQuery = () =>
  queryOptions({
    queryKey: ["target-history"],
    queryFn: fetchTargetHistory,
    staleTime: 60_000,
  });

/**
 * Baut einen Auflöser: für ein Datum gilt der letzte Historien-Eintrag mit
 * valid_from <= Datum. Ohne passenden Eintrag greift der Fallback
 * (aktuell berechnete Ziel-Werte aus dem Profil).
 */
export function buildTargetsResolver(
  rows: TargetHistoryRow[],
  fallback: NutritionTargets | null,
): TargetsForDate {
  const sorted = [...rows].sort((a, b) => a.valid_from.localeCompare(b.valid_from));
  return (dateIso: string) => {
    let match: TargetHistoryRow | null = null;
    for (const row of sorted) {
      if (row.valid_from <= dateIso) match = row;
      else break;
    }
    return (match ? rowToTargets(match) : null) ?? fallback;
  };
}

/** Normalisiert Ziel-Werte oder einen Auflöser zu einem Auflöser. */
export function asTargetsResolver(
  input: NutritionTargets | null | TargetsForDate,
): TargetsForDate {
  return typeof input === "function" ? input : () => input;
}

/**
 * Die zu einem bestimmten Datum gültigen Ziel-Werte (Einzelabfrage).
 * Ersetzt den direkten Zugriff auf user_profile.target_* bei tagesbezogenen
 * Berechnungen.
 */
export async function getTargetsForDate(
  userId: string,
  date: Date | string,
): Promise<NutritionTargets | null> {
  const iso = isoOf(date);
  const { data, error } = await supabase
    .from("target_history")
    .select("*")
    .eq("user_id", userId)
    .lte("valid_from", iso)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const fromHistory = data ? rowToTargets(data) : null;
  if (fromHistory) return fromHistory;
  return computeTargets(await fetchUserProfile());
}

function sameTargets(row: TargetHistoryRow, t: NutritionTargets): boolean {
  const eq = (a: number | string | null, b: number) =>
    Math.round(Number(a ?? 0)) === Math.round(b);
  return (
    eq(row.target_calories, t.calories) &&
    eq(row.target_protein_g, t.protein_g) &&
    eq(row.target_carbs_g, t.carbs_g) &&
    eq(row.target_fat_g, t.fat_g) &&
    eq(row.target_fiber_g, t.fiber_g) &&
    eq(row.target_sugar_max_g, t.sugar_max_g)
  );
}

/**
 * Einmalige Nachbefüllung: Wenn noch kein Historien-Eintrag konkrete
 * Ziel-Werte hat (z. B. weil die Ziele bisher nur aus dem Profil berechnet
 * wurden), werden die aktuellen Werte in den frühesten Eintrag geschrieben.
 * Damit gelten sie für alle bereits vorhandenen vergangenen Tage.
 */
export async function seedTargetHistory(
  userId: string,
  rows: TargetHistoryRow[],
  targets: NutritionTargets | null,
): Promise<boolean> {
  if (!targets) return false;
  if (rows.some((r) => r.target_calories != null)) return false;
  const values = {
    target_calories: targets.calories,
    target_protein_g: targets.protein_g,
    target_carbs_g: targets.carbs_g,
    target_fat_g: targets.fat_g,
    target_fiber_g: targets.fiber_g,
    target_sugar_max_g: targets.sugar_max_g,
  };
  const earliest = [...rows].sort((a, b) => a.valid_from.localeCompare(b.valid_from))[0];
  if (earliest) {
    const { error } = await supabase
      .from("target_history")
      .update(values)
      .eq("id", earliest.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("target_history").insert({
      user_id: userId,
      ...values,
      valid_from: toISODateLocal(new Date()),
    });
    if (error) throw error;
  }
  return true;
}

/**
 * Schreibt die aktuell gültigen Ziel-Werte mit valid_from = HEUTE fort.
 * Vergangene Einträge bleiben unverändert – dadurch werden abgeschlossene
 * Tage nicht rückwirkend neu bewertet.
 */
export async function recordTargetsForToday(
  userId: string,
  targets: NutritionTargets | null,
): Promise<void> {
  if (!targets) return;
  const today = toISODateLocal(new Date());
  const { data: latest, error } = await supabase
    .from("target_history")
    .select("*")
    .eq("user_id", userId)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (latest && latest.valid_from <= today && sameTargets(latest, targets)) return;

  const { error: upErr } = await supabase.from("target_history").upsert(
    {
      user_id: userId,
      target_calories: targets.calories,
      target_protein_g: targets.protein_g,
      target_carbs_g: targets.carbs_g,
      target_fat_g: targets.fat_g,
      target_fiber_g: targets.fiber_g,
      target_sugar_max_g: targets.sugar_max_g,
      valid_from: today,
    },
    { onConflict: "user_id,valid_from" },
  );
  if (upErr) throw upErr;
}
