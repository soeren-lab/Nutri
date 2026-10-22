import { db } from "@/integrations/db/client";
import type { IngredientMaster, IngredientPrefill } from "@/lib/ingredients-master";
import { OFF_SOURCE, lookupBarcode, resolveBrandId } from "@/lib/openfoodfacts";

/** Ergebnis eines Barcode-Scans: schon in der eigenen Bibliothek, oder noch als Zutat anzulegen. */
export type BarcodeResolution =
  | { kind: "own"; master: IngredientMaster; packAmount: number | null; restored: boolean }
  | { kind: "new"; prefill: IngredientPrefill; packAmount: number | null; notice: string | null };

/**
 * Schlägt einen Barcode zuerst in der eigenen Zutaten-Bibliothek nach (archivierte Zutaten werden
 * wiederhergestellt), danach in Open Food Facts. Wirft bei Fehlern eine verständliche Meldung.
 */
export async function resolveBarcode(code: string, userId: string): Promise<BarcodeResolution> {
  const { data: own } = await db
    .from("ingredients_master")
    .select("*")
    .eq("user_id", userId)
    .eq("source_barcode", code)
    .limit(1)
    .maybeSingle();

  if (own) {
    let restored = false;
    if (own.archived) {
      const { error } = await db
        .from("ingredients_master")
        .update({ archived: false })
        .eq("id", own.id);
      if (error) throw error;
      restored = true;
    }
    // Packungsgröße nur als Vorschlag – ohne Netz oder bei Fehler einfach weglassen.
    const off = await lookupBarcode(code).catch(() => null);
    return {
      kind: "own",
      master: { ...own, archived: false },
      packAmount: off?.product?.packAmount ?? null,
      restored,
    };
  }

  const { product, error } = await lookupBarcode(code);
  if (error) throw new Error(error);
  if (!product) {
    return {
      kind: "new",
      prefill: { source_barcode: code },
      packAmount: null,
      notice: "Produkt nicht in Open Food Facts gefunden. Trag die Werte selbst ein.",
    };
  }
  const brand_id = await resolveBrandId(userId, product.brand);
  return {
    kind: "new",
    packAmount: product.packAmount,
    notice:
      product.calories == null
        ? "Produkt gefunden, aber ohne Nährwerte. Trag sie vom Etikett ein."
        : null,
    prefill: {
      name: product.name,
      brand_id,
      image_url: product.imageUrl,
      unit: product.unit,
      calories: product.calories,
      protein_g: product.protein_g,
      carbs_g: product.carbs_g,
      fat_g: product.fat_g,
      fiber_g: product.fiber_g,
      sugar_g: product.sugar_g,
      source: OFF_SOURCE,
      source_barcode: product.id,
    },
  };
}
