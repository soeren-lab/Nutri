import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { searchOffProducts, type OffProduct } from "@/lib/openfoodfacts.functions";
import { DEFAULT_INGREDIENT_CATEGORY } from "@/lib/categories";
import type { IngredientMaster } from "@/lib/ingredients-master";

export type { OffProduct };

export const OFF_SOURCE = "openfoodfacts";

/** Suche in Open Food Facts. Fehler blockieren die eigene Suche nie. */
export const offSearchQuery = (query: string) =>
  queryOptions({
    queryKey: ["off-search", query.trim().toLowerCase()],
    queryFn: () => searchOffProducts({ data: { query: query.trim() } }),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

/** Marke nach Name finden (case-insensitive) oder neu anlegen. */
async function resolveBrandId(userId: string, name: string | null): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const { data: existing } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabase
    .from("brands")
    .insert({ name: trimmed, user_id: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Importiert ein Open-Food-Facts-Produkt als private Stammzutat.
 * Marke wird verknüpft bzw. angelegt, Bild-URL bleibt extern.
 */
export async function importOffProduct(p: OffProduct): Promise<IngredientMaster> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Nicht angemeldet");

  const { data: dupe } = await supabase
    .from("ingredients_master")
    .select("id, name")
    .eq("user_id", uid)
    .eq("source_barcode", p.id)
    .limit(1)
    .maybeSingle();
  if (dupe) throw new Error(`„${dupe.name}" ist bereits in deiner Bibliothek`);

  const brand_id = await resolveBrandId(uid, p.brand);

  const { data, error } = await supabase
    .from("ingredients_master")
    .insert({
      user_id: uid,
      name: p.name,
      brand_id,
      image_url: p.imageUrl,
      unit: p.unit,
      category: DEFAULT_INGREDIENT_CATEGORY,
      subcategory: null,
      calories: p.calories,
      protein_g: p.protein_g,
      carbs_g: p.carbs_g,
      fat_g: p.fat_g,
      fiber_g: p.fiber_g,
      sugar_g: p.sugar_g,
      density_g_per_ml: null,
      source: OFF_SOURCE,
      source_barcode: p.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
