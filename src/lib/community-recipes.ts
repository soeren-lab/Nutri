import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import type { DiffField } from "@/lib/community";
import { normalizeName, publishIngredient, similarity } from "@/lib/community";
import { fetchSharedSourceIds, sharedSourceHasUpdate } from "@/lib/shared-sources";


type Recipe = Tables<"recipes">;
type Step = Tables<"steps">;
type Ingredient = Tables<"ingredients">;
type RecipeComponent = Tables<"recipe_components">;
type ComponentVariant = Tables<"component_variants">;
type MasterRow = Tables<"ingredients_master">;
type BrandRow = Tables<"brands">;

type SourceMaster = MasterRow & { brand: BrandRow | null };
type SourceIngredient = Ingredient & { master: SourceMaster | null };

export type RecipeBundle = {
  recipe: Recipe;
  steps: Step[];
  components: RecipeComponent[];
  variants: ComponentVariant[];
  ingredients: SourceIngredient[];
};

async function requireUid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Nicht angemeldet");
  return uid;
}

/** Lädt alle Rohdaten eines Rezepts (ohne Auflösung verlinkter Rezepte). */
export async function fetchRecipeBundle(id: string): Promise<RecipeBundle | null> {
  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!recipe) return null;

  const [steps, components, ingredients] = await Promise.all([
    supabase.from("steps").select("*").eq("recipe_id", id),
    supabase.from("recipe_components").select("*").eq("recipe_id", id),
    supabase
      .from("ingredients")
      .select("*, master:ingredients_master(*, brand:brands(*))")
      .eq("recipe_id", id),
  ]);
  if (steps.error) throw steps.error;
  if (components.error) throw components.error;
  if (ingredients.error) throw ingredients.error;

  const componentIds = (components.data ?? []).map((c) => c.id);
  let variants: ComponentVariant[] = [];
  if (componentIds.length > 0) {
    const { data, error: vErr } = await supabase
      .from("component_variants")
      .select("*")
      .in("component_id", componentIds);
    if (vErr) throw vErr;
    variants = data ?? [];
  }

  return {
    recipe,
    steps: steps.data ?? [],
    components: components.data ?? [],
    variants,
    ingredients: (ingredients.data ?? []) as unknown as SourceIngredient[],
  };
}

/* -------------------------------------------------- Veröffentlichen */

/** Alle rekursiv verlinkten Rezept-IDs (Beilagen/Komponenten). */
async function linkedRecipeIds(rootId: string): Promise<string[]> {
  const out = new Set<string>();
  const queue = [rootId];
  const visited = new Set<string>([rootId]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const { data, error } = await supabase
      .from("recipe_components")
      .select("linked_recipe_id")
      .eq("recipe_id", current)
      .not("linked_recipe_id", "is", null);
    if (error) throw error;
    for (const row of data ?? []) {
      const id = row.linked_recipe_id!;
      if (visited.has(id)) continue;
      visited.add(id);
      out.add(id);
      queue.push(id);
    }
  }
  return Array.from(out);
}

/** Verlinkte Beilagen-Rezepte, die noch nicht öffentlich sind. */
export async function unpublishedLinkedRecipes(
  recipeId: string,
): Promise<Array<{ id: string; title: string }>> {
  const ids = await linkedRecipeIds(recipeId);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, is_published")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []).filter((r) => !r.is_published).map((r) => ({ id: r.id, title: r.title }));
}

/** Fuzzy-Check gegen bereits veröffentlichte Rezepte. */
export async function findSimilarPublishedRecipe(
  title: string,
  excludeId?: string,
): Promise<{ id: string; title: string; score: number } | null> {
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title")
    .eq("is_published", true);
  if (error) throw error;
  let best: { id: string; title: string; score: number } | null = null;
  for (const row of data ?? []) {
    if (excludeId && row.id === excludeId) continue;
    const score = similarity(title, row.title);
    if (score >= 0.8 && (!best || score > best.score)) {
      best = { id: row.id, title: row.title, score };
    }
  }
  return best;
}

async function publishSingleRecipe(id: string, bumpVersion: boolean): Promise<Recipe> {
  const { data: current, error: cErr } = await supabase
    .from("recipes")
    .select("published_version, is_published")
    .eq("id", id)
    .single();
  if (cErr) throw cErr;

  const version = bumpVersion
    ? (current.published_version ?? 0) + 1
    : Math.max(1, current.published_version ?? 0);

  const { data, error } = await supabase
    .from("recipes")
    .update({ is_published: true, published_version: version })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Alle im Rezept verwendeten eigenen Stammzutaten mitveröffentlichen. */
async function publishUsedMasters(recipeIds: string[], uid: string): Promise<void> {
  const { data, error } = await supabase
    .from("ingredients")
    .select("ingredient_master_id")
    .in("recipe_id", recipeIds)
    .not("ingredient_master_id", "is", null);
  if (error) throw error;
  const ids = Array.from(new Set((data ?? []).map((r) => r.ingredient_master_id!)));
  if (ids.length === 0) return;
  const { data: masters, error: mErr } = await supabase
    .from("ingredients_master")
    .select("id, is_published, user_id")
    .in("id", ids);
  if (mErr) throw mErr;
  for (const m of masters ?? []) {
    if (m.user_id !== uid || m.is_published) continue;
    await publishIngredient(m.id);
  }
}

/**
 * Veröffentlicht ein Rezept inkl. Komponenten/Varianten. Verlinkte Beilagen
 * und verwendete Stammzutaten werden mitveröffentlicht.
 */
export async function publishRecipe(id: string): Promise<Recipe> {
  const uid = await requireUid();
  const linked = await linkedRecipeIds(id);
  await publishUsedMasters([id, ...linked], uid);
  for (const linkedId of linked) {
    const { data } = await supabase
      .from("recipes")
      .select("user_id, is_published")
      .eq("id", linkedId)
      .maybeSingle();
    if (data && data.user_id === uid && !data.is_published) {
      await publishSingleRecipe(linkedId, false);
    }
  }
  return publishSingleRecipe(id, true);
}

export async function unpublishRecipe(id: string): Promise<void> {
  const { error } = await supabase.from("recipes").update({ is_published: false }).eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------- Import */

async function resolveOwnBrandId(uid: string, brand: BrandRow | null): Promise<string | null> {
  if (!brand) return null;
  const { data, error } = await supabase.from("brands").select("*").eq("user_id", uid);
  if (error) throw error;
  const match = (data ?? []).find((b) => normalizeName(b.name) === normalizeName(brand.name));
  if (match) return match.id;
  const { data: created, error: cErr } = await supabase
    .from("brands")
    .insert({ name: brand.name, user_id: uid })
    .select("id")
    .single();
  if (cErr) throw cErr;
  return created.id;
}

/** Findet oder erstellt eine eigene Kopie einer fremden Stammzutat. */
async function resolveOwnMaster(
  uid: string,
  source: SourceMaster,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(source.id);
  if (cached) return cached;

  const { data: own, error } = await supabase
    .from("ingredients_master")
    .select("id, name, brand_id, source_ingredient_id, brand:brands(name)")
    .eq("user_id", uid);
  if (error) throw error;

  const rows = (own ?? []) as Array<{
    id: string;
    name: string;
    source_ingredient_id: string | null;
    brand: { name: string } | null;
  }>;
  const sourceBrand = normalizeName(source.brand?.name ?? "");
  const match =
    rows.find((r) => r.source_ingredient_id === source.id) ??
    rows.find(
      (r) =>
        normalizeName(r.name) === normalizeName(source.name) &&
        normalizeName(r.brand?.name ?? "") === sourceBrand,
    );
  if (match) {
    cache.set(source.id, match.id);
    return match.id;
  }

  const brandId = await resolveOwnBrandId(uid, source.brand ?? null);
  const { data: created, error: cErr } = await supabase
    .from("ingredients_master")
    .insert({
      user_id: uid,
      name: source.name,
      brand_id: brandId,
      image_url: source.image_url,
      unit: source.unit,
      category: source.category,
      subcategory: source.subcategory,
      calories: source.calories,
      protein_g: source.protein_g,
      carbs_g: source.carbs_g,
      fat_g: source.fat_g,
      fiber_g: source.fiber_g,
      sugar_g: source.sugar_g,
      density_g_per_ml: source.density_g_per_ml,
      source_ingredient_id: source.id,
      imported_version: source.published_version,
      is_published: false,
      published_version: 0,
    })
    .select("id")
    .single();
  if (cErr) throw cErr;
  cache.set(source.id, created.id);
  return created.id;
}

/** Inhalte (Komponenten, Varianten, Zutaten, Schritte) in ein Ziel-Rezept schreiben. */
async function writeBundleInto(
  targetRecipeId: string,
  uid: string,
  bundle: RecipeBundle,
  masterCache: Map<string, string>,
  recipeCache: Map<string, string>,
  depth: number,
): Promise<void> {
  const componentIdMap = new Map<string, string>();
  const variantIdMap = new Map<string, string>();

  for (const c of bundle.components) {
    let linkedId: string | null = null;
    if (c.linked_recipe_id && depth < 4) {
      linkedId = await copyRecipeDeep(c.linked_recipe_id, uid, masterCache, recipeCache, depth + 1);
    }
    const { data, error } = await supabase
      .from("recipe_components")
      .insert({
        recipe_id: targetRecipeId,
        name: c.name,
        servings: c.servings,
        sort_order: c.sort_order,
        component_type: c.component_type,
        linked_recipe_id: linkedId,
      })
      .select("id")
      .single();
    if (error) throw error;
    componentIdMap.set(c.id, data.id);
  }

  for (const v of bundle.variants) {
    const componentId = componentIdMap.get(v.component_id);
    if (!componentId) continue;
    const { data, error } = await supabase
      .from("component_variants")
      .insert({
        component_id: componentId,
        label: v.label,
        sort_order: v.sort_order,
        is_default: v.is_default,
      })
      .select("id")
      .single();
    if (error) throw error;
    variantIdMap.set(v.id, data.id);
  }

  const ingredientRows = [];
  for (const ing of bundle.ingredients) {
    const masterId = ing.master ? await resolveOwnMaster(uid, ing.master, masterCache) : null;
    ingredientRows.push({
      recipe_id: targetRecipeId,
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      sort_order: ing.sort_order,
      calories: ing.calories,
      protein_g: ing.protein_g,
      carbs_g: ing.carbs_g,
      fat_g: ing.fat_g,
      fiber_g: ing.fiber_g,
      sugar_g: ing.sugar_g,
      product_group: ing.product_group,
      ingredient_master_id: masterId,
      component_id: ing.component_id ? (componentIdMap.get(ing.component_id) ?? null) : null,
      variant_id: ing.variant_id ? (variantIdMap.get(ing.variant_id) ?? null) : null,
    });
  }
  if (ingredientRows.length > 0) {
    const { error } = await supabase.from("ingredients").insert(ingredientRows);
    if (error) throw error;
  }

  if (bundle.steps.length > 0) {
    const { error } = await supabase.from("steps").insert(
      bundle.steps.map((s) => ({
        recipe_id: targetRecipeId,
        step_number: s.step_number,
        instruction: s.instruction,
      })),
    );
    if (error) throw error;
  }
}

/**
 * Findet einen freien Rezept-Titel für den Nutzer. Existiert der Titel schon,
 * wird "(2)", "(3)", … angehängt, bis ein freier Name gefunden ist.
 */
export async function generateUniqueRecipeName(
  userId: string,
  baseTitle: string,
): Promise<string> {
  const base = baseTitle.replace(/\s*\((\d+)\)\s*$/, "").trim() || baseTitle.trim();
  const { data, error } = await supabase
    .from("recipes")
    .select("title")
    .eq("user_id", userId);
  if (error) throw error;
  const taken = new Set((data ?? []).map((r) => normalizeName(r.title)));
  if (!taken.has(normalizeName(base))) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})`;
    if (!taken.has(normalizeName(candidate))) return candidate;
  }
}

async function copyRecipeDeep(
  sourceId: string,
  uid: string,
  masterCache: Map<string, string>,
  recipeCache: Map<string, string>,
  depth: number,
): Promise<string | null> {
  const cached = recipeCache.get(sourceId);
  if (cached) return cached;

  const bundle = await fetchRecipeBundle(sourceId);
  if (!bundle) return null;
  const s = bundle.recipe;
  const title = await generateUniqueRecipeName(uid, s.title);

  const { data: created, error } = await supabase
    .from("recipes")
    .insert({
      user_id: uid,
      title,
      description: s.description,
      image_url: s.image_url,
      servings: s.servings,
      prep_time_minutes: s.prep_time_minutes,
      cook_time_minutes: s.cook_time_minutes,
      category: s.category,
      categories: s.categories,
      tag: s.tag,
      nutrition_mode: s.nutrition_mode,
      is_component_only: s.is_component_only,
      calories: s.calories,
      protein_g: s.protein_g,
      carbs_g: s.carbs_g,
      fat_g: s.fat_g,
      fiber_g: s.fiber_g,
      sugar_g: s.sugar_g,
      source_recipe_id: s.id,
      imported_version: s.published_version,
      source_updated_at: s.updated_at,

      is_published: false,
      published_version: 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  recipeCache.set(sourceId, created.id);

  await writeBundleInto(created.id, uid, bundle, masterCache, recipeCache, depth);
  return created.id;
}

/** Vollständige Kopie eines Community-Rezepts in die eigene Sammlung. */
export async function importCommunityRecipe(sourceId: string): Promise<string> {
  const uid = await requireUid();
  const newId = await copyRecipeDeep(sourceId, uid, new Map(), new Map(), 0);
  if (!newId) throw new Error("Rezept nicht verfügbar");
  return newId;
}

/* -------------------------------------------------- Updates */

export type RecipeUpdate = {
  copy: Recipe;
  source: Recipe;
  /** "shared" = privat geteiltes Original (kein Versionszähler). */
  kind: "community" | "shared";
};

export async function fetchRecipeUpdates(): Promise<RecipeUpdate[]> {
  const uid = await requireUid();
  const { data: copies, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("user_id", uid)
    .not("source_recipe_id", "is", null);
  if (error) throw error;
  if (!copies || copies.length === 0) return [];

  const ids = Array.from(new Set(copies.map((c) => c.source_recipe_id!)));
  const { data: sources, error: sErr } = await supabase
    .from("recipes")
    .select("*")
    .in("id", ids);
  const shared = await fetchSharedSourceIds();

  if (sErr) throw sErr;
  const byId = new Map((sources ?? []).map((s) => [s.id, s]));

  const out: RecipeUpdate[] = [];
  for (const copy of copies) {
    const source = byId.get(copy.source_recipe_id!);
    if (!source) continue;
    if (source.is_published) {
      const sv = source.published_version ?? 0;
      const iv = copy.imported_version ?? 0;
      const dv = copy.dismissed_version ?? 0;
      if (sv > iv && sv > dv) out.push({ copy, source, kind: "community" });
    } else if (shared.recipes.has(source.id)) {
      if (
        sharedSourceHasUpdate(
          source.updated_at,
          copy.source_updated_at,
          copy.dismissed_source_updated_at,
        )
      )
        out.push({ copy, source, kind: "shared" });
    }
  }
  return out;
}


export const recipeUpdatesQuery = () =>
  queryOptions({ queryKey: ["recipe_updates"], queryFn: fetchRecipeUpdates });

/** Übernimmt die neue Version: Kopfdaten und alle Inhalte werden ersetzt. */
export async function applyRecipeUpdate(update: RecipeUpdate): Promise<void> {
  const uid = await requireUid();
  const bundle = await fetchRecipeBundle(update.source.id);
  if (!bundle) throw new Error("Original nicht verfügbar");
  const s = bundle.recipe;
  const targetId = update.copy.id;

  const del = await Promise.all([
    supabase.from("ingredients").delete().eq("recipe_id", targetId),
    supabase.from("steps").delete().eq("recipe_id", targetId),
  ]);
  for (const r of del) if (r.error) throw r.error;
  const { error: cErr } = await supabase
    .from("recipe_components")
    .delete()
    .eq("recipe_id", targetId);
  if (cErr) throw cErr;

  const { error: uErr } = await supabase
    .from("recipes")
    .update({
      title: s.title,
      description: s.description,
      image_url: s.image_url,
      servings: s.servings,
      prep_time_minutes: s.prep_time_minutes,
      cook_time_minutes: s.cook_time_minutes,
      category: s.category,
      categories: s.categories,
      tag: s.tag,
      nutrition_mode: s.nutrition_mode,
      calories: s.calories,
      protein_g: s.protein_g,
      carbs_g: s.carbs_g,
      fat_g: s.fat_g,
      fiber_g: s.fiber_g,
      sugar_g: s.sugar_g,
      imported_version: s.published_version ?? 0,
      dismissed_version: null,
      source_updated_at: s.updated_at,
      dismissed_source_updated_at: null,

    })
    .eq("id", targetId);
  if (uErr) throw uErr;

  await writeBundleInto(targetId, uid, bundle, new Map(), new Map(), 0);
}

export async function dismissRecipeUpdate(update: RecipeUpdate): Promise<void> {
  const { error } = await supabase
    .from("recipes")
    .update({
      dismissed_version: update.source.published_version ?? 0,
      dismissed_source_updated_at: update.source.updated_at,
    })

    .eq("id", update.copy.id);
  if (error) throw error;
}

const RECIPE_DIFF_FIELDS: Array<{
  key: keyof Recipe;
  label: string;
  suffix?: string;
}> = [
  { key: "title", label: "Titel" },
  { key: "description", label: "Beschreibung" },
  { key: "servings", label: "Portionen" },
  { key: "prep_time_minutes", label: "Vorbereitung", suffix: " Min" },
  { key: "cook_time_minutes", label: "Kochzeit", suffix: " Min" },
  { key: "calories", label: "Kalorien", suffix: " kcal" },
  { key: "protein_g", label: "Protein", suffix: " g" },
  { key: "carbs_g", label: "Kohlenhydrate", suffix: " g" },
  { key: "fat_g", label: "Fett", suffix: " g" },
  { key: "fiber_g", label: "Ballaststoffe", suffix: " g" },
  { key: "categories", label: "Kategorien" },
];

function fmtValue(v: unknown, suffix?: string): string {
  if (Array.isArray(v)) return v.length > 0 ? v.join(", ") : "–";
  if (v == null || v === "") return "–";
  return `${v}${suffix ?? ""}`;
}

export function diffRecipe(copy: Recipe, source: Recipe): DiffField[] {
  const out: DiffField[] = [];
  for (const f of RECIPE_DIFF_FIELDS) {
    const a = copy[f.key] ?? null;
    const b = source[f.key] ?? null;
    const before = fmtValue(a, f.suffix);
    const after = fmtValue(b, f.suffix);
    if (before === after) continue;
    out.push({ key: String(f.key), label: f.label, before, after });
  }
  if ((copy.image_url ?? null) !== (source.image_url ?? null)) {
    out.push({ key: "image_url", label: "Bild", before: "alt", after: "neu" });
  }
  return out;
}
