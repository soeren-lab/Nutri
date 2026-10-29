import { queryOptions } from "@tanstack/react-query";
import { db } from "@/integrations/db/client";
import type { Tables } from "@/integrations/db/types";

export type WaterEntry = Tables<"water_entries">;

/** Schnelltasten im Wasser-Zähler (Glas, Tasse, Flasche). */
export const WATER_STEPS_ML = [150, 250, 500] as const;
export const DEFAULT_WATER_GOAL_ML = 2500;

export async function fetchWater(dateIso: string): Promise<WaterEntry[]> {
  const { data, error } = await db
    .from("water_entries")
    .select("*")
    .eq("date", dateIso)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((e) => ({ ...e, date: e.date.slice(0, 10) }));
}

export const waterQuery = (dateIso: string) =>
  queryOptions({
    queryKey: ["water", dateIso],
    queryFn: () => fetchWater(dateIso),
    staleTime: 30_000,
  });

/** Die ID kommt vom Aufrufer, damit ein Eintrag offline sofort angezeigt und später unverändert gesendet wird. */
export async function addWaterEntry(input: {
  id: string;
  userId: string;
  date: string;
  amountMl: number;
}): Promise<void> {
  const { error } = await db.from("water_entries").insert({
    id: input.id,
    user_id: input.userId,
    date: input.date,
    amount_ml: input.amountMl,
  });
  // Kam die Antwort nicht an und die Änderung wird wiederholt, existiert der Eintrag schon.
  if (error && !/duplicate/i.test(error.message)) throw error;
}

export async function deleteWaterEntry(id: string): Promise<void> {
  const { error } = await db.from("water_entries").delete().eq("id", id);
  if (error) throw error;
}

export function totalWaterMl(entries: readonly { amount_ml: number }[]): number {
  return entries.reduce((sum, e) => sum + e.amount_ml, 0);
}

/** 1250 -> "1,25 l", 750 -> "750 ml". */
export function formatWater(ml: number): string {
  if (ml >= 1000) {
    const liters = Math.round(ml / 10) / 100;
    return `${liters.toLocaleString("de-DE")} l`;
  }
  return `${Math.round(ml)} ml`;
}

// --- Tagesziel (nur auf diesem Gerät) ----------------------------------------

const GOAL_KEY = "nutri.water.goalMl.v1";
/** Wird gesendet, wenn das Ziel geändert wurde (z. B. fürs Widget). */
export const WATER_GOAL_EVENT = "nutri:water-goal";

export function getWaterGoal(): number {
  try {
    const n = Number(localStorage.getItem(GOAL_KEY));
    return Number.isFinite(n) && n >= 500 && n <= 10_000 ? n : DEFAULT_WATER_GOAL_ML;
  } catch {
    return DEFAULT_WATER_GOAL_ML;
  }
}

export function setWaterGoal(ml: number) {
  try {
    localStorage.setItem(GOAL_KEY, String(Math.round(ml)));
    window.dispatchEvent(new Event(WATER_GOAL_EVENT));
  } catch {
    /* ohne Speicher bleibt der Standard */
  }
}
