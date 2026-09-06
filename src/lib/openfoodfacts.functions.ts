import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Suche in der Open Food Facts Datenbank (öffentliche JSON-API).
 * Läuft serverseitig, damit User-Agent/Rate-Limits kontrolliert sind und
 * kein CORS-Problem im Browser entsteht.
 */
export type OffProduct = {
  /** Barcode – dient als stabile ID. */
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  /** "g" oder "ml" – Basis der Nährwerte je 100 Einheiten. */
  unit: string;
};

const FIELDS = [
  "code",
  "product_name",
  "product_name_de",
  "brands",
  "image_url",
  "quantity",
  "nutriments",
].join(",");

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10) / 10;
}

function normalize(raw: Record<string, unknown>): OffProduct | null {
  const code = typeof raw["code"] === "string" ? raw["code"] : null;
  const name =
    (typeof raw["product_name_de"] === "string" && raw["product_name_de"].trim()) ||
    (typeof raw["product_name"] === "string" && raw["product_name"].trim()) ||
    "";
  if (!code || !name) return null;

  const nutriments = (raw["nutriments"] ?? {}) as Record<string, unknown>;
  const kcal =
    num(nutriments["energy-kcal_100g"]) ??
    (num(nutriments["energy_100g"]) != null
      ? Math.round((num(nutriments["energy_100g"]) as number) / 4.184)
      : null);

  // Search-a-licious liefert brands als Array, die Legacy-API als CSV-String.
  const rawBrands = raw["brands"];
  const brand = Array.isArray(rawBrands)
    ? (typeof rawBrands[0] === "string" ? rawBrands[0].trim() : "") || null
    : typeof rawBrands === "string"
      ? rawBrands.split(",")[0]?.trim() || null
      : null;

  const quantity = typeof raw["quantity"] === "string" ? raw["quantity"] : "";
  const unit = /\bml\b|\bl\b/i.test(quantity) ? "ml" : "g";

  return {
    id: code,
    name,
    brand,
    imageUrl:
      (typeof raw["image_url"] === "string" && raw["image_url"]) ||
      (typeof raw["image_front_small_url"] === "string" && raw["image_front_small_url"]) ||
      null,
    calories: kcal,
    protein_g: num(nutriments["proteins_100g"]),
    carbs_g: num(nutriments["carbohydrates_100g"]),
    fat_g: num(nutriments["fat_100g"]),
    fiber_g: num(nutriments["fiber_100g"]),
    sugar_g: num(nutriments["sugars_100g"]),
    unit,
  };
}

export const searchOffProducts = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ query: z.string().min(2).max(80) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ products: OffProduct[]; error: string | null }> => {
    // Search-a-licious API mit deutschem Sprach- und Länderfilter:
    // sucht in product_name.de / categories.de und nur in Produkten aus Deutschland.
    const url = new URL("https://search.openfoodfacts.org/search");
    url.searchParams.set("q", `${data.query} countries_tags:"en:germany"`);
    url.searchParams.set("langs", "de");
    url.searchParams.set("page_size", "25");
    url.searchParams.set("fields", FIELDS);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Nutri/1.0 (Lovable app; ingredient import)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.error("[OFF] HTTP", res.status, (await res.text()).slice(0, 300));
        return { products: [], error: "Open Food Facts nicht erreichbar" };
      }
      const json = (await res.json()) as { hits?: Record<string, unknown>[] };
      const products = (json.hits ?? [])
        .map(normalize)
        .filter((p): p is OffProduct => p !== null)
        // Ohne Kalorien ist ein Import für uns wertlos.
        .filter((p) => p.calories != null)
        .slice(0, 15);
      return { products, error: null };
    } catch (e) {
      console.error("[OFF] search failed", e);
      return { products: [], error: "Open Food Facts nicht erreichbar" };
    }
  });
