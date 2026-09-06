import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarSignedUrl } from "@/lib/avatar";
import { fetchPublishedRecipesByUser } from "@/lib/recipes";
import type { CommunityIngredient } from "@/lib/community";
import type { RecipeListItem } from "@/types/recipe";

export type PublicProfile = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalPoints: number;
  currentStreakDays: number;
};

/**
 * Öffentliche Profil-Basisdaten (Username, Bild, Punkte, Streak) über
 * Security-Definer-RPC – keine Ziel-/Körperwerte.
 */
export async function fetchPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("get_public_profile", {
    _username: username,
  });
  if (error) throw error;
  const row = (data ?? [])[0] as
    | {
        user_id: string;
        username: string;
        avatar_url: string | null;
        total_points: number;
        current_streak_days: number;
      }
    | undefined;
  if (!row) return null;
  return {
    userId: row.user_id,
    username: row.username,
    avatarUrl: await getAvatarSignedUrl(row.avatar_url),
    totalPoints: row.total_points ?? 0,
    currentStreakDays: row.current_streak_days ?? 0,
  };
}

export const publicProfileQuery = (username: string) =>
  queryOptions({
    queryKey: ["public_profile", username],
    queryFn: () => fetchPublicProfile(username),
  });

/** Veröffentlichte Zutaten eines Nutzers. */
export async function fetchPublishedIngredientsByUser(
  userId: string,
): Promise<CommunityIngredient[]> {
  const { data, error } = await supabase
    .from("ingredients_master")
    .select("*, brand:brands(*)")
    .eq("is_published", true)
    .eq("archived", false)
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CommunityIngredient[];
}

export const publishedIngredientsByUserQuery = (userId: string) =>
  queryOptions({
    queryKey: ["published_ingredients", userId],
    queryFn: () => fetchPublishedIngredientsByUser(userId),
  });

export const publishedRecipesByUserQuery = (userId: string) =>
  queryOptions({
    queryKey: ["published_recipes", userId],
    queryFn: (): Promise<RecipeListItem[]> => fetchPublishedRecipesByUser(userId),
  });
