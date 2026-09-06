import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { DEFAULT_INGREDIENT_CATEGORY } from "@/lib/categories";
import { freeIngredients } from "@/lib/componentNutrition";
import {
  isChoiceComponent,
  parseVariantSelection,
  selectedVariantId,
  type VariantSelection,
} from "@/lib/variants";
import { fetchRecipeNodesByIds } from "@/lib/recipes";
import { applyGroupChoices } from "@/lib/productGroups";
import type { RecipeComponentWithRelations, RecipeNode } from "@/types/recipe";
import {
  batchFormSize,
  fixedBatchServings,
  isFixedBatch,
} from "@/lib/batch";
import {
  fetchMastersByIds,
  fetchMealPlan,
  parseGroupChoices,
  plannedServings,
  toISODate,
  type MealPlanEntryFull,
} from "@/lib/meal-plan";
import type { IngredientWithMaster } from "@/types/recipe";

export type ShoppingListItem = Tables<"shopping_list_items"> & {
  /** Anzeige-Anreicherung aus der Stammzutat (kein DB-Feld). */
  brand_name?: string | null;
  master_image_url?: string | null;
};

/** Zeitraum-Presets für die Generierung. */
export type ShoppingRangePreset = "week" | "next3" | "custom";

export async function fetchShoppingList(): Promise<ShoppingListItem[]> {
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const items = data ?? [];

  // Marke/Bild der verknüpften Stammzutaten nachladen, damit der Nutzer
  // beim Einkaufen das konkrete Produkt erkennt.
  const masterIds = Array.from(
    new Set(items.map((i) => i.ingredient_master_id).filter((id): id is string => !!id)),
  );
  if (masterIds.length === 0) return items;

  const { data: masters, error: mErr } = await supabase
    .from("ingredients_master")
    .select("id, image_url, brand:brands(name)")
    .in("id", masterIds);
  if (mErr) return items;

  const infoById = new Map(
    (masters ?? []).map((m) => [
      m.id,
      {
        image: m.image_url ?? null,
        brand: (m.brand as { name: string } | null)?.name ?? null,
      },
    ]),
  );
  return items.map((i) => {
    const info = i.ingredient_master_id ? infoById.get(i.ingredient_master_id) : undefined;
    return { ...i, brand_name: info?.brand ?? null, master_image_url: info?.image ?? null };
  });
}

export const shoppingListQuery = () =>
  queryOptions({ queryKey: ["shopping-list"], queryFn: fetchShoppingList });

type Aggregated = {
  key: string;
  ingredient_master_id: string | null;
  name: string;
  amount: number | null;
  unit: string | null;
  category: string;
  recipeIds: Set<string>;
};

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Zutaten einer Komponente für den Einkauf – bewusst großzügig:
 * Bei Auswahl-Komponenten zählt die gewählte Variante; lässt sich diese
 * nicht auflösen (fehlende Varianten-Daten), werden alle Zutaten
 * übernommen, damit nie etwas verloren geht.
 */
function shoppingComponentIngredients(
  c: RecipeComponentWithRelations,
  selection: VariantSelection,
): IngredientWithMaster[] {
  const rows = c.ingredients ?? [];
  if (rows.length === 0) return rows;
  if (!isChoiceComponent(c)) {
    const plain = rows.filter((i) => !i.variant_id);
    return plain.length > 0 ? plain : rows;
  }
  const vid = selectedVariantId(c, selection) ?? selection[c.id] ?? null;
  const chosen = vid ? rows.filter((i) => i.variant_id === vid) : [];
  if (chosen.length > 0) return chosen;
  // Keine Variante auflösbar: Zutaten ohne Varianten-Bezug sind immer nötig.
  const plain = rows.filter((i) => !i.variant_id);
  return plain.length > 0 ? plain : rows;
}

function pushRows(
  map: Map<string, Aggregated>,
  rows: IngredientWithMaster[],
  factor: number,
  recipeId: string | null,
) {
  for (const ing of rows) {
    // Eine fehlerhafte Zutat darf niemals die restlichen Zutaten des
    // Rezepts verhindern – deshalb jede Zeile isoliert verarbeiten.
    try {
      const master = ing.master;
      // Freitext-Zutaten und offene Produktgruppen dürfen nicht verloren gehen.
      const name = (master?.name ?? ing.name ?? ing.product_group ?? "").trim();
      if (!name) {
        console.warn("[Einkaufsliste] Zutat ohne Namen – wird übersprungen", {
          recipeId,
          ingredientId: ing.id,
        });
        continue;
      }
      const unit = ing.unit ?? master?.unit ?? null;
      const masterId = ing.ingredient_master_id ?? null;
      const key = `${masterId ?? `n:${name.toLowerCase()}`}|${unit ?? ""}`;
      const raw = ing.amount == null ? NaN : Number(ing.amount);
      if (!Number.isFinite(raw) || raw <= 0) {
        console.warn(
          `[Einkaufsliste] Zutat "${name}" ohne gültige Menge – wird übersprungen`,
          { recipeId, ingredientId: ing.id, amount: ing.amount },
        );
        continue;
      }
      const amount = raw * factor;
      const existing = map.get(key);
      if (existing) {
        existing.amount = round1((existing.amount ?? 0) + amount);
        if (recipeId) existing.recipeIds.add(recipeId);
        continue;
      }
      map.set(key, {
        key,
        ingredient_master_id: masterId,
        name,
        amount: round1(amount),
        unit,
        category: master?.category || DEFAULT_INGREDIENT_CATEGORY,
        recipeIds: new Set(recipeId ? [recipeId] : []),
      });
    } catch (err) {
      console.warn("[Einkaufsliste] Zutat konnte nicht verarbeitet werden", err);
    }
  }
}


/** Rekursiv alle Zutaten eines Rezept-Knotens erfassen (inkl. Komponenten). */
function collectFromRecipeNode(
  map: Map<string, Aggregated>,
  recipe: RecipeNode,
  planned: number,
  selection: VariantSelection,
  depth = 0,
) {
  if (depth > 6) return;
  const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
  pushRows(map, freeIngredients(recipe), planned / servings, recipe.id);

  for (const c of recipe.components ?? []) {
    const cs = c.servings && c.servings > 0 ? c.servings : 1;
    // Verlinkte Komponenten rekursiv – deren eigene Komponenten zählen mit.
    if (c.linked_recipe_id && c.linked) {
      // Eine Portion der verlinkten Komponente je geplanter Rezeptportion.
      // Der verlinkte Knoten skaliert intern bereits mit seiner Portionszahl.
      collectFromRecipeNode(map, c.linked, planned, selection, depth + 1);
      // Zutaten, die direkt an der Komponente hängen, zählen zusätzlich.
      pushRows(map, shoppingComponentIngredients(c, selection), planned / cs, recipe.id);
      continue;
    }
    pushRows(map, shoppingComponentIngredients(c, selection), planned / cs, recipe.id);
  }
}

export function aggregateLoadedShoppingEntries(
  entries: MealPlanEntryFull[],
  nodes: Map<string, RecipeNode>,
  masters: Awaited<ReturnType<typeof fetchMastersByIds>>,
) {
  const map = new Map<string, Aggregated>();
  for (const entry of entries) {
    const choices = parseGroupChoices(entry.group_choices);
    const resolved =
      Object.keys(choices).length > 0
        ? new Map(
            Array.from(nodes.entries()).map(([id, node]) => [
              id,
              applyGroupChoices(node, choices, masters),
            ]),
          )
        : nodes;
    try {
      collectFromEntry(map, entry, null, resolved);
    } catch (err) {
      console.warn("[Einkaufsliste] Planer-Eintrag übersprungen", entry.id, err);
    }
  }
  return Array.from(map.values());
}

function collectFromEntry(
  map: Map<string, Aggregated>,
  entry: MealPlanEntryFull,
  servingsOverride?: number | null,
  nodes?: Map<string, RecipeNode>,
) {
  // Die vorhandenen Fremdschlüssel sind maßgeblich. Ältere/kopierte Einträge
  // können zusätzliche Snapshot-Felder oder einen veralteten food_type haben.
  if (entry.recipe_id) {
    const recipe = nodes?.get(entry.recipe_id) ?? (entry.recipe as RecipeNode | null);
    if (!recipe) {
      console.warn("[Einkaufsliste] Rezept konnte nicht geladen werden", {
        entryId: entry.id,
        recipeId: entry.recipe_id,
      });
      return;
    }

    const selection = parseVariantSelection(entry.selected_variant_ids);
    const base = servingsOverride != null ? servingsOverride : plannedServings(entry);
    const planned = isFixedBatch(recipe) ? fixedBatchServings(base, batchFormSize(recipe)) : base;
    collectFromRecipeNode(map, recipe, planned, selection);
    return;
  }

  if (entry.ingredient_master_id) {
    const master = entry.ingredient;
    if (!master) {
      console.warn("[Einkaufsliste] Stammzutat konnte nicht geladen werden", {
        entryId: entry.id,
        ingredientMasterId: entry.ingredient_master_id,
      });
      return;
    }
    pushRows(
      map,
      [
        {
          ...({} as IngredientWithMaster),
          id: entry.id,
          name: master.name,
          amount: entry.amount == null ? null : Number(entry.amount),
          unit: entry.unit ?? master.unit,
          ingredient_master_id: master.id,
          master,
        } as IngredientWithMaster,
      ],
      1,
      null,
    );
    return;
  }
}

/**
 * Aggregierte Zutaten eines Zeitraums (ohne Schnelleinträge).
 * Batch-Gruppen: die volle Menge zählt einmal am Koch-Tag,
 * vorgekochte Folgetage verursachen keinen weiteren Einkauf.
 */
export async function aggregateShoppingItems(from: Date, to: Date) {
  const entries = await fetchMealPlan(toISODate(from), toISODate(to));

  // Alle geplanten Rezepte vollständig laden – so fehlen weder Komponenten
  // noch Varianten, auch wenn das Rezept nicht in der eigenen Liste steht.
  const recipeIds = entries
    .map((e) => e.recipe_id)
    .filter((id): id is string => !!id);
  const nodes = await fetchRecipeNodesByIds(recipeIds);

  // Gewählte Sorten (Produktgruppen) auflösen, damit die echte Zutat zählt.
  const choiceIds = entries.flatMap((e) => Object.values(parseGroupChoices(e.group_choices)));
  const masters = await fetchMastersByIds(choiceIds);

  return aggregateLoadedShoppingEntries(entries, nodes, masters);
}

/**
 * Generiert Einkaufslisten-Einträge aus dem Planer und ergänzt die
 * bestehende Liste (gleiche Zutat + Einheit wird zusammengeführt).
 */
export async function generateShoppingList(
  userId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const aggregated = await aggregateShoppingItems(from, to);
  if (aggregated.length === 0) return 0;

  const existing = await fetchShoppingList();
  const keyOf = (i: ShoppingListItem) =>
    `${i.ingredient_master_id ?? `n:${i.name.toLowerCase()}`}|${i.unit ?? ""}`;
  const byKey = new Map(existing.filter((i) => !i.is_manual).map((i) => [keyOf(i), i]));

  const inserts: Array<Record<string, unknown>> = [];
  for (const a of aggregated) {
    const prev = byKey.get(a.key);
    const sources = Array.from(a.recipeIds);
    if (prev) {
      const merged = Array.from(new Set([...(prev.source_recipe_ids ?? []), ...sources]));
      const amount =
        a.amount == null
          ? prev.amount
          : round1(Number(prev.amount ?? 0) + a.amount);
      const { error } = await supabase
        .from("shopping_list_items")
        .update({ amount, source_recipe_ids: merged, is_checked: false })
        .eq("id", prev.id);
      if (error) console.warn("[Einkaufsliste] Update fehlgeschlagen", a.name, error);
      continue;
    }
    inserts.push({
      user_id: userId,
      ingredient_master_id: a.ingredient_master_id,
      name: a.name,
      amount: a.amount,
      unit: a.unit,
      category: a.category,
      is_manual: false,
      source_recipe_ids: sources,
    });
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from("shopping_list_items").insert(inserts as never);
    if (error) {
      // Einzeln nachfassen, damit ein fehlerhafter Datensatz nicht alle blockiert.
      console.warn("[Einkaufsliste] Sammel-Insert fehlgeschlagen, versuche einzeln", error);
      for (const row of inserts) {
        const { error: e2 } = await supabase.from("shopping_list_items").insert(row as never);
        if (e2) console.warn("[Einkaufsliste] Zutat konnte nicht gespeichert werden", row.name, e2);
      }
    }
  }

  return aggregated.length;
}

export async function addManualItem(input: {
  userId: string;
  name: string;
  amount: number | null;
  unit: string | null;
}): Promise<void> {
  const { error } = await supabase.from("shopping_list_items").insert({
    user_id: input.userId,
    name: input.name,
    amount: input.amount,
    unit: input.unit,
    category: DEFAULT_INGREDIENT_CATEGORY,
    is_manual: true,
    source_recipe_ids: [],
  });
  if (error) throw error;
}

export async function updateShoppingItem(
  id: string,
  input: { name: string; amount: number | null; unit: string | null; category: string },
): Promise<void> {
  const { error } = await supabase
    .from("shopping_list_items")
    .update({
      name: input.name,
      amount: input.amount,
      unit: input.unit,
      category: input.category,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function setItemChecked(id: string, checked: boolean): Promise<void> {
  const { error } = await supabase
    .from("shopping_list_items")
    .update({ is_checked: checked })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const { error } = await supabase.from("shopping_list_items").delete().eq("id", id);
  if (error) throw error;
}

export async function clearShoppingList(userId: string): Promise<void> {
  const { error } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

/** Reihenfolge nach typischem Supermarkt-Laufweg. */
export const SHOPPING_CATEGORY_ORDER = [
  "Obst",
  "Gemüse",
  "Fleisch & Fisch",
  "Milchprodukte",
  "Getreide & Backwaren",
  "Gewürze & Kräuter",
  "Öle & Fette",
  "Süßungsmittel",
  "Getränke",
  "Supplements",
  "Sonstiges",
] as const;

function formatNumber(n: number, digits = 2): string {
  const rounded = Number(n.toFixed(digits));
  return rounded.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

/**
 * Mengenangabe als Text, z. B. "250 g", "3,58 l" oder "1,07 kg".
 * Große Gramm-/Milliliter-Mengen werden in kg/l umgerechnet.
 */
export function amountLabel(item: ShoppingListItem): string | null {
  if (item.amount == null) return item.unit ? item.unit : null;
  const n = Number(item.amount);
  const unit = (item.unit ?? "").trim();
  const lower = unit.toLowerCase();

  if (lower === "g" && Math.abs(n) >= 1000) return `${formatNumber(n / 1000)} kg`;
  if ((lower === "ml" || lower === "milliliter") && Math.abs(n) >= 1000)
    return `${formatNumber(n / 1000)} l`;

  const value = Number.isInteger(n) ? String(n) : formatNumber(round1(n), 1);
  return unit ? `${value} ${unit}` : value;
}
