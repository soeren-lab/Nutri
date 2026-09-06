import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { queryOptions } from "@tanstack/react-query";

export type IngredientMaster = Tables<"ingredients_master">;

export const MASTER_UNITS = ["g", "ml", "Stück"] as const;
export type MasterUnit = (typeof MASTER_UNITS)[number];

export async function fetchIngredientsMaster(includeArchived = false): Promise<IngredientMaster[]> {
  // getSession() liest die lokale Session ohne Netzwerk-Request – wichtig,
  // damit ein Offline-Fehlschlag hier nicht fälschlich als "kein Nutzer"
  // interpretiert wird und den Cache mit einer leeren Liste überschreibt.
  const { data: sessionRes } = await supabase.auth.getSession();
  const uid = sessionRes.session?.user?.id;
  if (!uid) return [];
  let q = supabase
    .from("ingredients_master")
    .select("*")
    .eq("user_id", uid)
    .order("name", { ascending: true });
  if (!includeArchived) q = q.eq("archived", false);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export const ingredientsMasterQuery = (includeArchived = false) =>
  queryOptions({
    queryKey: ["ingredients_master", { includeArchived }],
    queryFn: () => fetchIngredientsMaster(includeArchived),
  });

export async function countIngredientMasterUsage(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("ingredients")
    .select("id", { count: "exact", head: true })
    .eq("ingredient_master_id", id);
  if (error) throw error;
  return count ?? 0;
}

export async function archiveIngredientMaster(id: string): Promise<void> {
  const { error } = await supabase
    .from("ingredients_master")
    .update({ archived: true })
    .eq("id", id);
  if (error) throw error;
}

export async function unarchiveIngredientMaster(id: string): Promise<void> {
  const { error } = await supabase
    .from("ingredients_master")
    .update({ archived: false })
    .eq("id", id);
  if (error) throw error;
}

export type IngredientMasterInput = {
  name: string;
  brand_id: string | null;
  image_url: string | null;
  unit: string;
  category: string;
  subcategory: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  density_g_per_ml: number | null;
};


/**
 * `id` wird vom Aufrufer übergeben (client-generierte UUID), nicht von der
 * DB vergeben – nur so kann eine neue Zutat offline sofort optimistisch im
 * Cache angezeigt und später unverändert synchronisiert werden.
 */
export async function createIngredientMaster(
  input: IngredientMasterInput,
  id: string = crypto.randomUUID(),
): Promise<IngredientMaster> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Nicht angemeldet");
  const { data, error } = await supabase
    .from("ingredients_master")
    .insert({ id, ...input, user_id: uid })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateIngredientMaster(
  id: string,
  input: IngredientMasterInput,
): Promise<IngredientMaster> {
  const { data, error } = await supabase
    .from("ingredients_master")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteIngredientMaster(id: string): Promise<void> {
  const { error } = await supabase.from("ingredients_master").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Löscht eine Stammzutat endgültig. Vorher werden alle verknüpften
 * Rezept-Zutaten mit einem Snapshot der aktuellen Nährwerte (auf ihre
 * jeweilige Menge/Einheit umgerechnet) beschrieben, damit sie unabhängig
 * weiter funktionieren.
 */
export async function hardDeleteIngredientMasterWithSnapshot(id: string): Promise<void> {
  const { computeNutritionFromMaster } = await import("@/lib/unitConversion");

  const { data: master, error: mErr } = await supabase
    .from("ingredients_master")
    .select("*")
    .eq("id", id)
    .single();
  if (mErr) throw mErr;
  if (!master) throw new Error("Zutat nicht gefunden");

  const { data: rows, error: rErr } = await supabase
    .from("ingredients")
    .select("id, amount, unit")
    .eq("ingredient_master_id", id);
  if (rErr) throw rErr;

  for (const row of rows ?? []) {
    const n = computeNutritionFromMaster(master, row.amount, row.unit);
    const { error: uErr } = await supabase
      .from("ingredients")
      .update({
        name: master.name,
        calories: n.calories,
        protein_g: n.protein_g,
        carbs_g: n.carbs_g,
        fat_g: n.fat_g,
        fiber_g: n.fiber_g,
        sugar_g: n.sugar_g,
        ingredient_master_id: null,
      })
      .eq("id", row.id);
    if (uErr) throw uErr;
  }

  const { error: dErr } = await supabase
    .from("ingredients_master")
    .delete()
    .eq("id", id);
  if (dErr) throw dErr;
}

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export async function uploadIngredientImage(userId: string, file: File): Promise<string> {
  const type = file.type.toLowerCase();
  const nameLower = file.name.toLowerCase();
  if (nameLower.endsWith(".heic") || nameLower.endsWith(".heif") || type === "image/heic" || type === "image/heif") {
    throw new Error("HEIC/HEIF wird von Browsern nicht angezeigt. Bitte als JPG, PNG oder WebP hochladen.");
  }
  if (type && !SUPPORTED_IMAGE_TYPES.includes(type)) {
    throw new Error("Nicht unterstütztes Bildformat. Bitte JPG, PNG, WebP, GIF oder AVIF verwenden.");
  }
  const ext = (nameLower.split(".").pop() || "jpg").replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("ingredient-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function getIngredientSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("ingredient-images")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Compute nutrition for a recipe ingredient given the amount used
 * and a master entry whose values are stored per 100 base units.
 * For unit "Stk" the master values are per 1 piece.
 */
export function computeFromMaster(
  master: Pick<
    IngredientMaster,
    "unit" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sugar_g"
  >,
  amount: number | null,
): {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
} {
  if (amount == null || amount <= 0) {
    return { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, sugar_g: null };
  }
  const factor = master.unit === "Stk" ? amount : amount / 100;
  const scale = (v: number | null) => (v == null ? null : Math.round(v * factor * 10) / 10);
  return {
    calories: scale(master.calories),
    protein_g: scale(master.protein_g),
    carbs_g: scale(master.carbs_g),
    fat_g: scale(master.fat_g),
    fiber_g: scale(master.fiber_g),
    sugar_g: scale(master.sugar_g),
  };
}

/** Text used by search inputs: matches name and subcategory. */
export function ingredientSearchText(
  m: Pick<IngredientMaster, "name" | "subcategory">,
): string {
  return `${m.name} ${m.subcategory ?? ""}`;
}

/** True when the query only matches via subcategory (context hint needed). */
export function matchesViaSubcategory(
  m: Pick<IngredientMaster, "name" | "subcategory">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q || !m.subcategory) return false;
  return (
    m.subcategory.toLowerCase().includes(q) && !m.name.toLowerCase().includes(q)
  );
}

/** Distinct subcategory values of the user's ingredients, alphabetical. */
export function collectSubcategories(list: IngredientMaster[]): string[] {
  const set = new Set<string>();
  list.forEach((m) => {
    const s = m.subcategory?.trim();
    if (s) set.add(s);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
}
