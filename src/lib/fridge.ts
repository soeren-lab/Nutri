import { queryOptions } from "@tanstack/react-query";
import { db } from "@/integrations/db/client";
import type { Tables } from "@/integrations/db/types";

export const FRIDGE_LOCATIONS = [
  { id: "fridge", label: "Kühlschrank" },
  { id: "freezer", label: "Tiefkühler" },
  { id: "pantry", label: "Vorrat" },
] as const;
export type FridgeLocation = (typeof FRIDGE_LOCATIONS)[number]["id"];

export type FridgeMaster = {
  id: string;
  name: string;
  unit: string;
  image_url: string | null;
  category: string;
  brand: { name: string } | null;
};

export type FridgeItem = Tables<"fridge_items"> & { master: FridgeMaster | null };

export async function fetchFridge(): Promise<FridgeItem[]> {
  const { data, error } = await db
    .from("fridge_items")
    .select("*, master:ingredients_master(id, name, unit, image_url, category, brand:brands(name))")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FridgeItem[];
}

export const fridgeQuery = () =>
  queryOptions({ queryKey: ["fridge"], queryFn: fetchFridge, staleTime: 30_000 });

/** Legt einen Bestand an – oder addiert auf eine vorhandene Zeile (gleiche Zutat, Ort und Datum). */
export async function addToFridge(input: {
  userId: string;
  masterId: string;
  amount: number;
  unit: string;
  location: FridgeLocation;
  expiresAt: string | null;
}): Promise<void> {
  const { data: rows, error: selErr } = await db
    .from("fridge_items")
    .select("id, amount, expires_at")
    .eq("user_id", input.userId)
    .eq("ingredient_master_id", input.masterId)
    .eq("location", input.location);
  if (selErr) throw selErr;
  const same = (rows ?? []).find((r) => (r.expires_at ?? null) === input.expiresAt);
  if (same) {
    const { error } = await db
      .from("fridge_items")
      .update({ amount: same.amount + input.amount })
      .eq("id", same.id);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("fridge_items").insert({
    id: crypto.randomUUID(),
    user_id: input.userId,
    ingredient_master_id: input.masterId,
    amount: input.amount,
    unit: input.unit,
    location: input.location,
    expires_at: input.expiresAt,
  });
  if (error) throw error;
}

export async function updateFridgeItem(
  id: string,
  patch: { amount: number; location: FridgeLocation; expires_at: string | null },
): Promise<void> {
  const { error } = await db.from("fridge_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteFridgeItem(id: string): Promise<void> {
  const { error } = await db.from("fridge_items").delete().eq("id", id);
  if (error) throw error;
}

// --- Haltbarkeit -----------------------------------------------------------

export type ExpiryTone = "none" | "ok" | "soon" | "expired";

export function daysUntil(dateIso: string, now = new Date()): number {
  const [y, m, d] = dateIso.slice(0, 10).split("-").map(Number);
  const target = Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function expiryTone(dateIso: string | null, now = new Date()): ExpiryTone {
  if (!dateIso) return "none";
  const days = daysUntil(dateIso, now);
  if (days < 0) return "expired";
  return days <= 3 ? "soon" : "ok";
}

export function expiryLabel(dateIso: string | null, now = new Date()): string {
  if (!dateIso) return "";
  const days = daysUntil(dateIso, now);
  if (days < -1) return `seit ${-days} Tagen abgelaufen`;
  if (days === -1) return "gestern abgelaufen";
  if (days === 0) return "läuft heute ab";
  if (days === 1) return "läuft morgen ab";
  if (days <= 14) return `noch ${days} Tage`;
  return new Date(dateIso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export function addDaysIso(days: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// --- Menge anzeigen --------------------------------------------------------

export function formatAmount(amount: number, unit: string): string {
  if (unit === "g" && amount >= 1000) return `${trim(amount / 1000)} kg`;
  if (unit === "ml" && amount >= 1000) return `${trim(amount / 1000)} l`;
  return `${trim(amount)} ${unit}`;
}

function trim(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString("de-DE");
}

// --- Merkhilfen (nur auf diesem Gerät) ---------------------------------------

const LAST_AMOUNT_KEY = "nutri.fridge.lastAmount.v1";
const USAGE_KEY = "nutri.fridge.usage.v1";

function readMap(key: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function writeMap(key: string, map: Record<string, number>) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* ohne Speicher geht es auch */
  }
}

/** Zuletzt eingegebene Menge je Zutat: der nächste Scan desselben Produkts braucht nur einen Tipp. */
export function lastAmountFor(masterId: string): number | null {
  return readMap(LAST_AMOUNT_KEY)[masterId] ?? null;
}

export function rememberAdd(masterId: string, amount: number) {
  const last = readMap(LAST_AMOUNT_KEY);
  last[masterId] = amount;
  writeMap(LAST_AMOUNT_KEY, last);
  const usage = readMap(USAGE_KEY);
  usage[masterId] = (usage[masterId] ?? 0) + 1;
  writeMap(USAGE_KEY, usage);
}

/** Wie oft eine Zutat schon eingelagert wurde, für die Reihenfolge der Schnellauswahl. */
export function usageCounts(): Record<string, number> {
  return readMap(USAGE_KEY);
}
