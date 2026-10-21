import { queryOptions } from "@tanstack/react-query";
import { db } from "@/integrations/db/client";
import { lookupOffByBarcode, searchOffProducts, type OffProduct } from "@/lib/openfoodfacts.functions";
import { DEFAULT_INGREDIENT_CATEGORY } from "@/lib/categories";
import type { IngredientMaster } from "@/lib/ingredients-master";
import { isNativeApp } from "@/lib/platform";

export type { OffProduct };

export const OFF_SOURCE = "openfoodfacts";

// Muss mit WORKER_URL in scripts/build-capacitor-shell.mjs übereinstimmen.
const PRODUCTION_ORIGIN = "https://tanstack-start-ts.nutriapp.workers.dev";

/**
 * Die Capacitor-App läuft komplett lokal gebündelt (kein `server.url`, siehe
 * capacitor.config.ts) – ein relativer `/_serverFn/…`-Aufruf geht dort ins
 * Leere. Für die OFF-Suche hängen wir den Aufruf deshalb nativ explizit auf
 * die echte, deployte Worker-URL um. CORS dafür ist gezielt für GET-
 * Server-Functions in src/server.ts freigeschaltet (die OFF-Suche braucht
 * keine Authentifizierung).
 */
function nativeServerFnFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  const absolute = url.startsWith("http") ? url : `${PRODUCTION_ORIGIN}${url}`;
  return fetch(absolute, init);
}

/** Suche in Open Food Facts. Fehler blockieren die eigene Suche nie. */
export const offSearchQuery = (query: string) =>
  queryOptions({
    queryKey: ["off-search", query.trim().toLowerCase()],
    queryFn: () =>
      searchOffProducts({
        data: { query: query.trim() },
        ...(isNativeApp() ? { fetch: nativeServerFnFetch } : {}),
      }),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

/** Produkt per Barcode nachschlagen. `product: null` = nicht (vollständig) in OFF. */
export function lookupBarcode(code: string) {
  return lookupOffByBarcode({
    data: { code },
    ...(isNativeApp() ? { fetch: nativeServerFnFetch } : {}),
  });
}

/** Marke nach Name finden (case-insensitive) oder neu anlegen. */
export async function resolveBrandId(userId: string, name: string | null): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const { data: existing } = await db
    .from("brands")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await db
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
  const { data: userRes } = await db.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Nicht angemeldet");

  const { data: dupe } = await db
    .from("ingredients_master")
    .select("id, name, archived")
    .eq("user_id", uid)
    .eq("source_barcode", p.id)
    .limit(1)
    .maybeSingle();
  if (dupe) {
    if (!dupe.archived) throw new Error(`„${dupe.name}" ist bereits in deiner Bibliothek`);
    // War bereits importiert, aber zwischenzeitlich gelöscht (archiviert) –
    // stattdessen wiederherstellen statt einen "bereits vorhanden"-Fehler zu
    // werfen, sonst könnte man eine gelöschte OFF-Zutat nie wieder importieren.
    const { data: restored, error } = await db
      .from("ingredients_master")
      .update({ archived: false })
      .eq("id", dupe.id)
      .select("*")
      .single();
    if (error) throw error;
    return restored;
  }

  const brand_id = await resolveBrandId(uid, p.brand);

  const { data, error } = await db
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
