import { supabase } from "@/integrations/supabase/client";

/**
 * IDs der Rezepte/Zutaten, die Freunde privat mit mir geteilt haben.
 * Wird gebraucht, damit auch nicht veröffentlichte Originale Updates liefern.
 */
export async function fetchSharedSourceIds(): Promise<{
  recipes: Set<string>;
  ingredients: Set<string>;
}> {
  const empty = { recipes: new Set<string>(), ingredients: new Set<string>() };
  const { data: userRes } = await supabase.auth.getUser();
  const me = userRes.user?.id;
  if (!me) return empty;

  const { data, error } = await supabase
    .from("shared_with_friends")
    .select("content_type, content_id")
    .eq("friend_user_id", me);
  if (error) throw error;

  for (const row of data ?? []) {
    if (row.content_type === "recipe") empty.recipes.add(row.content_id);
    else if (row.content_type === "ingredient") empty.ingredients.add(row.content_id);
  }
  return empty;
}

/** Zeitstempel-Vergleich für privat geteilte Originale. */
export function sharedSourceHasUpdate(
  sourceUpdatedAt: string | null,
  importedAt: string | null,
  dismissedAt: string | null,
): boolean {
  if (!sourceUpdatedAt) return false;
  const s = new Date(sourceUpdatedAt).getTime();
  const i = importedAt ? new Date(importedAt).getTime() : 0;
  const d = dismissedAt ? new Date(dismissedAt).getTime() : 0;
  // 1s Toleranz gegen Rundungen beim Speichern
  return s > i + 1000 && s > d + 1000;
}
