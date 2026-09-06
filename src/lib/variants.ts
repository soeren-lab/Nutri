import type { IngredientWithMaster, RecipeComponentWithRelations } from "@/types/recipe";

/** Zuordnung Komponente → gewählte Variante. */
export type VariantSelection = Record<string, string>;

export function isChoiceComponent(c: {
  component_type?: string | null;
}): boolean {
  return (c.component_type ?? "fixed") === "choice";
}

export function sortedVariants(c: RecipeComponentWithRelations) {
  return [...(c.variants ?? [])].sort((a, b) => a.sort_order - b.sort_order);
}

/** Standard-Variante (markiert oder die erste). */
export function defaultVariantId(c: RecipeComponentWithRelations): string | null {
  const list = sortedVariants(c);
  return list.find((v) => v.is_default)?.id ?? list[0]?.id ?? null;
}

/** Aktuell gültige Variante – aus Auswahl oder Standard. */
export function selectedVariantId(
  c: RecipeComponentWithRelations,
  selection?: VariantSelection | null,
): string | null {
  const chosen = selection?.[c.id];
  if (chosen && sortedVariants(c).some((v) => v.id === chosen)) return chosen;
  return defaultVariantId(c);
}

/**
 * Zutaten, die für eine Komponente tatsächlich zählen:
 * - fixed: alle Zutaten ohne Varianten-Zuordnung
 * - choice: nur die Zutaten der gewählten Variante
 */
export function effectiveComponentIngredients(
  c: RecipeComponentWithRelations,
  selection?: VariantSelection | null,
): IngredientWithMaster[] {
  const rows = c.ingredients ?? [];
  if (!isChoiceComponent(c)) return rows.filter((i) => !i.variant_id);
  const vid = selectedVariantId(c, selection);
  if (!vid) return [];
  return rows.filter((i) => i.variant_id === vid);
}

/** Standard-Auswahl für alle Auswahl-Komponenten eines Rezepts. */
export function defaultSelection(
  components: RecipeComponentWithRelations[] | null | undefined,
): VariantSelection {
  const out: VariantSelection = {};
  for (const c of components ?? []) {
    if (!isChoiceComponent(c)) continue;
    const vid = defaultVariantId(c);
    if (vid) out[c.id] = vid;
  }
  return out;
}

/** Robustes Lesen des in meal_plan_entries gespeicherten JSON-Mappings. */
export function parseVariantSelection(value: unknown): VariantSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: VariantSelection = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
