import type { IngredientMaster } from "@/lib/ingredients-master";
import type {
  IngredientWithMaster,
  RecipeComponentWithRelations,
} from "@/types/recipe";
import { effectiveComponentIngredients, type VariantSelection } from "@/lib/variants";
import { freeIngredients } from "@/lib/componentNutrition";

/** Zuordnung Zutat-ID → gewählte Stammzutat (Sorte). */
export type GroupChoices = Record<string, string>;

/** Hinweistext für noch offene Produktgruppen. */
export const GROUP_HINT = "Sorte wählen";

/**
 * Flexible Zutat: sie ist an eine Produktgruppe gebunden und die Sorte darf
 * jederzeit getauscht werden – auch wenn bereits eine Sorte hinterlegt ist.
 */
export function isGroupIngredient(i: {
  product_group?: string | null;
  ingredient_master_id?: string | null;
}): boolean {
  return !!i.product_group?.trim();
}

/**
 * Offene Produktgruppe: eine Sorte fehlt noch. Sobald eine Stammzutat
 * verknüpft ist (Standard im Rezept oder Auswahl im Dialog), gilt die Zutat
 * als gewählt – Nährwerte werden berechnet und der Hinweis verschwindet.
 */
export function isUnresolvedGroupIngredient(i: {
  product_group?: string | null;
  ingredient_master_id?: string | null;
}): boolean {
  return isGroupIngredient(i) && !i.ingredient_master_id;
}


/** Alle verfügbaren Produktgruppen (= verwendete Untergruppen der Stammzutaten). */
export function productGroups(list: IngredientMaster[]): string[] {
  const set = new Set<string>();
  for (const m of list) {
    const s = m.subcategory?.trim();
    if (s) set.add(s);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
}

/** Stammzutaten einer Produktgruppe. */
export function mastersInGroup(list: IngredientMaster[], group: string): IngredientMaster[] {
  const g = group.trim().toLowerCase();
  return list.filter((m) => (m.subcategory?.trim().toLowerCase() ?? "") === g);
}

export interface PendingGroup {
  ingredient: IngredientWithMaster;
  /** Name der Komponente, in der die Zutat steckt (null = freie Zutat). */
  componentName: string | null;
}

/**
 * Alle Zutaten eines Rezepts, die eine Produktgruppe statt eines festen
 * Produkts verwenden – unter Berücksichtigung der gewählten Varianten.
 */
export function pendingGroupIngredients(
  node: {
    ingredients?: IngredientWithMaster[] | null;
    components?: RecipeComponentWithRelations[] | null;
  },
  selection?: VariantSelection | null,
  depth = 0,
): PendingGroup[] {
  if (depth > 6) return [];
  const out: PendingGroup[] = [];
  for (const i of freeIngredients({ ingredients: node.ingredients ?? [] })) {
    if (isUnresolvedGroupIngredient(i)) out.push({ ingredient: i, componentName: null });
  }
  for (const c of node.components ?? []) {
    if (c.linked_recipe_id && c.linked) {
      for (const p of pendingGroupIngredients(c.linked, selection, depth + 1)) {
        out.push({ ingredient: p.ingredient, componentName: p.componentName ?? c.name });
      }
      continue;
    }
    for (const i of effectiveComponentIngredients(c, selection)) {
      if (isUnresolvedGroupIngredient(i)) out.push({ ingredient: i, componentName: c.name });
    }
  }
  return out;
}

function applyToIngredient(
  i: IngredientWithMaster,
  choices: GroupChoices,
  masterById: Map<string, IngredientMaster>,
): IngredientWithMaster {
  if (!isGroupIngredient(i)) return i;
  const masterId = choices[i.id];
  const master = masterId ? masterById.get(masterId) : undefined;
  if (!master) return i;
  return { ...i, ingredient_master_id: master.id, master };
}

/**
 * Ersetzt Produktgruppen-Zutaten durch die gewählte Sorte, damit die
 * bestehende Nährwert-Berechnung greift (Kochmodus, Planer-Snapshot).
 */
export function applyGroupChoices<
  T extends { ingredients: IngredientWithMaster[]; components?: RecipeComponentWithRelations[] },
>(node: T, choices: GroupChoices, masters: IngredientMaster[], depth = 0): T {
  if (Object.keys(choices).length === 0 || depth > 6) return node;
  const masterById = new Map(masters.map((m) => [m.id, m]));
  const map = (rows: IngredientWithMaster[]) =>
    rows.map((i) => applyToIngredient(i, choices, masterById));
  return {
    ...node,
    ingredients: map(node.ingredients ?? []),
    components: (node.components ?? []).map((c) => ({
      ...c,
      ingredients: map(c.ingredients ?? []),
      linked: c.linked ? applyGroupChoices(c.linked, choices, masters, depth + 1) : c.linked,
    })),
  };
}

/* ----------------------------------------------- Komfort: letzte Sorte merken */

const STORAGE_KEY = "product-group-choices";

function readStore(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function lastGroupChoice(group: string): string | null {
  return readStore()[group.trim().toLowerCase()] ?? null;
}

export function rememberGroupChoice(group: string, masterId: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...readStore(), [group.trim().toLowerCase()]: masterId };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Speicher nicht verfügbar – Komfortfunktion ist optional. */
  }
}
