import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { queryOptions } from "@tanstack/react-query";
import type { RecipeListItem } from "@/types/recipe";

export type Cookbook = Tables<"cookbooks">;
export type CookbookRecipe = Tables<"cookbook_recipes">;
export type CookbookMember = Tables<"cookbook_members">;

export type CookbookWithCount = Cookbook & {
  recipe_count: number;
  /** true, wenn das Kochbuch einem anderen Nutzer gehört (beigetreten) */
  is_shared: boolean;
  /** Username des Erstellers bei geteilten Kochbüchern */
  owner_username: string | null;
};

export async function fetchCookbooks(): Promise<CookbookWithCount[]> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id ?? null;
  const { data, error } = await supabase
    .from("cookbooks")
    .select("*, cookbook_recipes(count)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];

  const foreignOwnerIds = Array.from(
    new Set(rows.filter((c) => c.user_id !== uid).map((c) => c.user_id)),
  );
  const usernames = new Map<string, string | null>();
  if (foreignOwnerIds.length > 0) {
    const { data: names } = await supabase.rpc("get_usernames", { _user_ids: foreignOwnerIds });
    for (const n of names ?? []) usernames.set(n.user_id, n.username);
  }

  return rows.map((c) => ({
    ...c,
    recipe_count: c.cookbook_recipes?.[0]?.count ?? 0,
    is_shared: c.user_id !== uid,
    owner_username: c.user_id !== uid ? (usernames.get(c.user_id) ?? null) : null,
  }));
}

/** Eigenes Mitgliedschafts-Eintrag entfernen (Kochbuch verlassen) */
export async function leaveCookbook(cookbookId: string): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Nicht angemeldet");
  const { error } = await supabase
    .from("cookbook_members")
    .delete()
    .eq("cookbook_id", cookbookId)
    .eq("user_id", uid);
  if (error) throw error;
}

export async function fetchCookbook(id: string): Promise<Cookbook> {
  const { data, error } = await supabase
    .from("cookbooks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Kochbuch nicht gefunden");
  return data;
}

export async function fetchCookbookRecipes(cookbookId: string): Promise<RecipeListItem[]> {
  const { data, error } = await supabase
    .from("cookbook_recipes")
    .select("sort_order, recipe:recipes(*, ingredients(*, master:ingredients_master(*)))")
    .eq("cookbook_id", cookbookId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => r.recipe).filter(Boolean) as unknown as RecipeListItem[];
}



export const cookbooksQuery = () =>
  queryOptions({ queryKey: ["cookbooks"], queryFn: fetchCookbooks });

export const cookbookQuery = (id: string) =>
  queryOptions({ queryKey: ["cookbooks", id], queryFn: () => fetchCookbook(id) });

export const cookbookRecipesQuery = (id: string) =>
  queryOptions({
    queryKey: ["cookbooks", id, "recipes"],
    queryFn: () => fetchCookbookRecipes(id),
  });

export type CookbookInput = {
  title: string;
  description: string | null;
  cover_image_url: string | null;
};

export async function createCookbook(input: CookbookInput): Promise<Cookbook> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Nicht angemeldet");
  const { data, error } = await supabase
    .from("cookbooks")
    .insert({ ...input, user_id: uid })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateCookbook(id: string, input: CookbookInput): Promise<Cookbook> {
  const { data, error } = await supabase
    .from("cookbooks")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCookbook(id: string): Promise<void> {
  const { error } = await supabase.from("cookbooks").delete().eq("id", id);
  if (error) throw error;
}

export async function addRecipesToCookbook(cookbookId: string, recipeIds: string[]) {
  if (recipeIds.length === 0) return;
  const { data: existing } = await supabase
    .from("cookbook_recipes")
    .select("recipe_id, sort_order")
    .eq("cookbook_id", cookbookId);
  const existingIds = new Set((existing ?? []).map((e) => e.recipe_id));
  const maxSort = (existing ?? []).reduce((m, r) => Math.max(m, r.sort_order), -1);
  const rows = recipeIds
    .filter((rid) => !existingIds.has(rid))
    .map((rid, i) => ({ cookbook_id: cookbookId, recipe_id: rid, sort_order: maxSort + 1 + i }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("cookbook_recipes").insert(rows);
  if (error) throw error;
}

export async function removeRecipeFromCookbook(cookbookId: string, recipeId: string) {
  const { error } = await supabase
    .from("cookbook_recipes")
    .delete()
    .eq("cookbook_id", cookbookId)
    .eq("recipe_id", recipeId);
  if (error) throw error;
}

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export async function uploadCookbookCover(userId: string, file: File): Promise<string> {
  const type = file.type.toLowerCase();
  const nameLower = file.name.toLowerCase();
  if (nameLower.endsWith(".heic") || nameLower.endsWith(".heif")) {
    throw new Error("HEIC/HEIF wird von Browsern nicht angezeigt. Bitte als JPG, PNG oder WebP hochladen.");
  }
  if (type && !SUPPORTED_IMAGE_TYPES.includes(type)) {
    throw new Error("Nicht unterstütztes Bildformat. Bitte JPG, PNG, WebP, GIF oder AVIF verwenden.");
  }
  const ext = (nameLower.split(".").pop() || "jpg").replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("cookbook-covers").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function getCookbookCoverSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("cookbook-covers")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) return null;
  return data.signedUrl;
}

export async function joinCookbookByToken(token: string): Promise<string> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Nicht angemeldet");
  // Use server function for token-based lookup (bypass RLS)
  const { getCookbookByShareToken, joinCookbookServerFn } = await import("./cookbooks-shared.functions");
  const info = await getCookbookByShareToken({ data: { token } });
  if (!info) throw new Error("Ungültiger Link");
  await joinCookbookServerFn({ data: { token } });
  return info.cookbook.id;
}

/* ============ Gezieltes Teilen mit Freunden ============ */

/** User-IDs der Mitglieder (Viewer) eines eigenen Kochbuchs. */
export async function fetchCookbookMemberIds(cookbookId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("cookbook_members")
    .select("user_id")
    .eq("cookbook_id", cookbookId);
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id);
}

export const cookbookMembersQuery = (cookbookId: string) =>
  queryOptions({
    queryKey: ["cookbooks", cookbookId, "members"],
    queryFn: () => fetchCookbookMemberIds(cookbookId),
  });

/** Setzt die Mitglieder eines Kochbuchs auf genau diese Freunde (role: viewer). */
export async function setCookbookMembers(cookbookId: string, friendUserIds: string[]) {
  const existing = await fetchCookbookMemberIds(cookbookId);
  const keep = new Set(friendUserIds);
  const toRemove = existing.filter((id) => !keep.has(id));
  const existingSet = new Set(existing);
  const toAdd = friendUserIds.filter((id) => !existingSet.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("cookbook_members")
      .delete()
      .eq("cookbook_id", cookbookId)
      .in("user_id", toRemove);
    if (error) throw error;
  }
  if (toAdd.length > 0) {
    const { error } = await supabase.from("cookbook_members").insert(
      toAdd.map((userId) => ({ cookbook_id: cookbookId, user_id: userId, role: "viewer" })),
    );
    if (error) throw error;
  }
}

/**
 * Kochbücher eines Freundes, die ich sehen darf (durch Mitgliedschaft geteilt).
 * RLS filtert automatisch alles heraus, wofür keine Freigabe besteht.
 */
export async function fetchFriendCookbooks(ownerUserId: string): Promise<CookbookWithCount[]> {
  if (!ownerUserId) return [];
  const { data, error } = await supabase
    .from("cookbooks")
    .select("*, cookbook_recipes(count)")
    .eq("user_id", ownerUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    ...c,
    recipe_count: c.cookbook_recipes?.[0]?.count ?? 0,
    is_shared: true,
    owner_username: null,
  }));
}

export const friendCookbooksQuery = (ownerUserId: string) =>
  queryOptions({
    queryKey: ["cookbooks", "friend", ownerUserId],
    queryFn: () => fetchFriendCookbooks(ownerUserId),
    enabled: !!ownerUserId,
  });
