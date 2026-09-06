import { supabase } from "@/integrations/supabase/client";
import type {
  ComponentVariant,
  RecipeComponentWithRelations,
  RecipeListItem,
  RecipeNode,
  RecipeWithRelations,
} from "@/types/recipe";
import { queryOptions } from "@tanstack/react-query";
import { fetchAuthorProfiles } from "@/lib/community";

const INGREDIENTS_WITH_MASTER = "*, master:ingredients_master(*)";
const NODE_SELECT = `*, ingredients(${INGREDIENTS_WITH_MASTER}), components:recipe_components!recipe_components_recipe_id_fkey(*, variants:component_variants(*))`;

/** Nur eigene Rezepte – fremde veröffentlichte Rezepte bleiben dem Community-Hub vorbehalten. */
export async function fetchRecipes(): Promise<RecipeListItem[]> {
  // getSession() liest die lokale Session ohne Netzwerk-Request – wichtig,
  // damit ein Offline-Fehlschlag hier nicht fälschlich als "kein Nutzer"
  // interpretiert wird und den Cache mit einer leeren Liste überschreibt.
  const { data: sessionRes } = await supabase.auth.getSession();
  const uid = sessionRes.session?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("recipes")
    .select(NODE_SELECT)
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return buildList((data ?? []) as unknown as RawNode[]);
}

/** Veröffentlichte Rezepte aller Nutzer inkl. eigener (Community-Hub). */
export async function fetchCommunityRecipes(): Promise<RecipeListItem[]> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id ?? "";
  const { data, error } = await supabase
    .from("recipes")
    .select(NODE_SELECT)
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const all = buildList((data ?? []) as unknown as RawNode[]);
  const filtered = all.filter((r) => !r.is_component_only);

  // Usernamen + Profilbilder der Ersteller laden
  const userIds = Array.from(new Set(filtered.map((r) => r.user_id)));
  const authorMap = await fetchAuthorProfiles(userIds);
  for (const r of filtered) {
    const a = authorMap.get(r.user_id);
    r.author_username = a?.username ?? null;
    r.author_avatar_url = a?.avatarUrl ?? null;
  }


  return filtered;
}

/** Veröffentlichte Rezepte eines bestimmten Nutzers (öffentliches Profil). */
export async function fetchPublishedRecipesByUser(
  userId: string,
): Promise<RecipeListItem[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select(NODE_SELECT)
    .eq("is_published", true)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return buildList((data ?? []) as unknown as RawNode[]).filter(
    (r) => !r.is_component_only,
  );
}

/** Rezepte zu bestimmten IDs (z. B. privat mit mir geteilte Rezepte). */
export async function fetchRecipesByIds(ids: string[]): Promise<RecipeListItem[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("recipes")
    .select(NODE_SELECT)
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return buildList((data ?? []) as unknown as RawNode[]);
}





/** Baut Rezept-Knoten inkl. verlinkter Komponenten aus einer flachen Liste. */
function buildList(rows: RawNode[]): RecipeListItem[] {
  const raw = rows.map(sortNode);
  // Verlinkte Komponenten werden aus derselben Liste aufgelöst (kein N+1).
  const byId = new Map(raw.map((r) => [r.id, r]));

  const build = (node: RawNode, depth: number): RecipeNode => ({
    ...node,
    components: withComponentIngredients(node).map((c) => ({
      ...c,
      linked:
        c.linked_recipe_id && depth < 6
          ? (() => {
              const target = byId.get(c.linked_recipe_id);
              return target ? build(target, depth + 1) : null;
            })()
          : null,
    })),
  });

  return raw.map((r) => build(r, 0));
}



type RawNode = Omit<RecipeNode, "components"> & {
  components: Array<Omit<RecipeComponentWithRelations, "linked">>;
};

function sortNode<T extends RawNode>(d: T) {
  return {
    ...d,
    ingredients: (d.ingredients ?? []).sort((a, b) => a.sort_order - b.sort_order),
    components: (d.components ?? [])
      .map((c) => ({
        ...c,
        variants: [...((c as { variants?: ComponentVariant[] }).variants ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
  };
}

/** Ordnet die flache Zutatenliste den jeweiligen Komponenten zu. */
function withComponentIngredients(d: RawNode) {
  const byComponent = new Map<string, RecipeComponentWithRelations["ingredients"]>();
  for (const ing of d.ingredients) {
    if (!ing.component_id) continue;
    const list = byComponent.get(ing.component_id) ?? [];
    list.push(ing);
    byComponent.set(ing.component_id, list);
  }
  return d.components.map((c) => ({ ...c, ingredients: byComponent.get(c.id) ?? [] }));
}

/**
 * Lädt ein Rezept als Knoten inkl. Komponenten. Verlinkte Komponenten
 * werden rekursiv aufgelöst (mit Tiefenbegrenzung als Sicherheitsnetz).
 */
async function fetchRecipeNode(id: string, depth: number): Promise<RecipeNode | null> {
  const { data, error } = await supabase
    .from("recipes")
    .select(NODE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const node = sortNode(data as unknown as RawNode);
  return {
    ...node,
    components: await resolveComponents(withComponentIngredients(node), depth),
  };
}

async function resolveComponents(
  components: Array<Omit<RecipeComponentWithRelations, "linked">>,
  depth: number,
): Promise<RecipeComponentWithRelations[]> {
  return Promise.all(
    components.map(async (c) => ({
      ...c,
      ingredients: (c.ingredients ?? []) as RecipeComponentWithRelations["ingredients"],
      linked:
        c.linked_recipe_id && depth < 6
          ? await fetchRecipeNode(c.linked_recipe_id, depth + 1)
          : null,
    })),
  );
}

/**
 * Lädt mehrere Rezepte als vollständige Knoten (Zutaten, Komponenten,
 * Varianten, verlinkte Rezepte) – unabhängig davon, wem sie gehören.
 */
export async function fetchRecipeNodesByIds(
  ids: string[],
): Promise<Map<string, RecipeNode>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const nodes = await Promise.all(unique.map((id) => fetchRecipeNode(id, 0)));
  const map = new Map<string, RecipeNode>();
  nodes.forEach((n) => {
    if (n) map.set(n.id, n);
  });
  return map;
}

export async function fetchRecipe(id: string): Promise<RecipeWithRelations> {
  const { data, error } = await supabase
    .from("recipes")
    .select(`${NODE_SELECT}, steps(*)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Rezept nicht gefunden");
  const d = sortNode(data as unknown as RawNode & { steps: RecipeWithRelations["steps"] });
  const components = await resolveComponents(withComponentIngredients(d), 0);

  return {
    ...d,
    components,
    steps: (d.steps ?? []).sort((a, b) => a.step_number - b.step_number),
  };
}

/**
 * Prüft rekursiv, ob eine Verlinkung einen Zirkelbezug erzeugen würde.
 * Bei neuen (noch nicht gespeicherten) Rezepten ist das nie der Fall.
 */
export async function linkCreatesCycle(
  parentRecipeId: string | null,
  targetRecipeId: string,
): Promise<boolean> {
  if (!parentRecipeId) return false;
  if (parentRecipeId === targetRecipeId) return true;
  const { data, error } = await supabase.rpc("recipe_link_creates_cycle", {
    _parent_recipe_id: parentRecipeId,
    _target_recipe_id: targetRecipeId,
  });
  if (error) throw error;
  return !!data;
}



export async function fetchFavorites(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("favorites")
    .select("recipe_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((f) => f.recipe_id);
}

export const recipesQuery = () =>
  queryOptions({ queryKey: ["recipes"], queryFn: fetchRecipes });

export const communityRecipesQuery = () =>
  queryOptions({ queryKey: ["community_recipes"], queryFn: fetchCommunityRecipes });


export const recipeQuery = (id: string) =>
  queryOptions({ queryKey: ["recipes", id], queryFn: () => fetchRecipe(id) });

export const favoritesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["favorites", userId],
    queryFn: () => fetchFavorites(userId),
  });

export async function toggleFavorite(userId: string, recipeId: string, isFav: boolean) {
  if (isFav) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("recipe_id", recipeId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("favorites").insert({ user_id: userId, recipe_id: recipeId });
    if (error) throw error;
  }
}

/**
 * Standard-Sorte einer flexiblen Zutat (Produktgruppe) im Rezept festhalten.
 * Wirkt dauerhaft – beim nächsten Öffnen ist sie vorausgewählt.
 */
export async function setIngredientMaster(ingredientId: string, masterId: string) {
  const { error } = await supabase
    .from("ingredients")
    .update({ ingredient_master_id: masterId })
    .eq("id", ingredientId);
  if (error) throw error;
}

export async function deleteRecipe(id: string) {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export async function uploadRecipeImage(userId: string, file: File): Promise<string> {
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
  const { error } = await supabase.storage.from("recipe-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: type || undefined,
  });
  if (error) throw error;
  return path;
}


export async function getSignedImageUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("recipe-images")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) return null;
  return data.signedUrl;
}
