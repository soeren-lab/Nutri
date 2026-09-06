import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarSignedUrls } from "@/lib/avatar";
import { fetchRecipesByIds } from "@/lib/recipes";
import { fetchAuthorProfiles } from "@/lib/community";
import type { CommunityIngredient } from "@/lib/community";
import type { RecipeListItem } from "@/types/recipe";

export type FriendContentType = "recipe" | "ingredient";

export type FriendUser = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalPoints: number;
  currentStreakDays?: number;
  /** Nur bei Freundesliste gesetzt: Zeitpunkt der Freundschaft. */
  friendsSince?: string | null;
};

export type FriendRequestItem = FriendUser & {
  requestId: string;
  createdAt: string;
};

/** Relation des eingeloggten Users zu einem anderen Nutzer. */
export type RelationState =
  | "none"
  | "friends"
  | "outgoing"
  | "incoming"
  | "self";

export type SearchResult = FriendUser & {
  relation: RelationState;
  /** Bei "incoming" die zugehörige Anfrage-ID. */
  requestId: string | null;
};

type RawProfileRow = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_points: number | null;
  current_streak_days?: number | null;
  friends_since?: string | null;
};

async function withAvatars<T extends RawProfileRow>(
  rows: T[],
): Promise<Map<string, string>> {
  return getAvatarSignedUrls(
    rows.map((r) => r.avatar_url).filter((p): p is string => !!p),
  );
}

function toFriendUser(row: RawProfileRow, avatars: Map<string, string>): FriendUser {
  return {
    userId: row.user_id,
    username: row.username,
    avatarUrl: row.avatar_url ? (avatars.get(row.avatar_url) ?? null) : null,
    totalPoints: row.total_points ?? 0,
    currentStreakDays: row.current_streak_days ?? 0,
    friendsSince: row.friends_since ?? null,
  };
}

/** Freundesliste des eingeloggten Users. */
export async function fetchMyFriends(): Promise<FriendUser[]> {
  const { data, error } = await supabase.rpc("get_my_friends");
  if (error) throw error;
  const rows = (data ?? []) as unknown as RawProfileRow[];
  const avatars = await withAvatars(rows);
  return rows.map((r) => toFriendUser(r, avatars));
}

export const myFriendsQuery = () =>
  queryOptions({ queryKey: ["friends", "list"], queryFn: fetchMyFriends });

async function fetchRequests(
  direction: "incoming" | "outgoing",
): Promise<FriendRequestItem[]> {
  const { data, error } = await supabase.rpc("get_friend_requests", {
    _direction: direction,
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as (RawProfileRow & {
    request_id: string;
    created_at: string;
  })[];
  const avatars = await withAvatars(rows);
  return rows.map((r) => ({
    ...toFriendUser(r, avatars),
    requestId: r.request_id,
    createdAt: r.created_at,
  }));
}

export const incomingRequestsQuery = () =>
  queryOptions({
    queryKey: ["friends", "requests", "incoming"],
    queryFn: () => fetchRequests("incoming"),
  });

export const outgoingRequestsQuery = () =>
  queryOptions({
    queryKey: ["friends", "requests", "outgoing"],
    queryFn: () => fetchRequests("outgoing"),
  });

/** Nutzersuche über Username inkl. aktueller Beziehung. */
export async function searchUsers(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [{ data, error }, friends, incoming, outgoing] = await Promise.all([
    supabase.rpc("search_users", { _query: q }),
    fetchMyFriends(),
    fetchRequests("incoming"),
    fetchRequests("outgoing"),
  ]);
  if (error) throw error;

  const rows = (data ?? []) as unknown as RawProfileRow[];
  const avatars = await withAvatars(rows);
  const friendIds = new Set(friends.map((f) => f.userId));
  const incomingMap = new Map(incoming.map((r) => [r.userId, r.requestId]));
  const outgoingIds = new Set(outgoing.map((r) => r.userId));

  return rows.map((row) => {
    const user = toFriendUser(row, avatars);
    const relation: RelationState = friendIds.has(user.userId)
      ? "friends"
      : incomingMap.has(user.userId)
        ? "incoming"
        : outgoingIds.has(user.userId)
          ? "outgoing"
          : "none";
    return { ...user, relation, requestId: incomingMap.get(user.userId) ?? null };
  });
}

export const userSearchQuery = (query: string) =>
  queryOptions({
    queryKey: ["friends", "search", query.trim().toLowerCase()],
    queryFn: () => searchUsers(query),
    enabled: query.trim().length >= 2,
  });

/** Anfrage senden (bzw. eine früher abgelehnte erneut öffnen). */
export async function sendFriendRequest(receiverId: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const senderId = userRes.user?.id;
  if (!senderId) throw new Error("Nicht angemeldet");
  if (senderId === receiverId) throw new Error("Das bist du selbst");

  const { error } = await supabase.from("friend_requests").upsert(
    {
      sender_id: senderId,
      receiver_id: receiverId,
      status: "pending",
      responded_at: null,
    },
    { onConflict: "sender_id,receiver_id" },
  );
  if (error) throw error;
}

export async function acceptFriendRequest(requestId: string) {
  const { error } = await supabase.rpc("accept_friend_request", {
    _request_id: requestId,
  });
  if (error) throw error;
}

export async function declineFriendRequest(requestId: string) {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw error;
}

/** Eigene, noch offene Anfrage zurückziehen. */
export async function withdrawFriendRequest(requestId: string) {
  const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);
  if (error) throw error;
}

export async function endFriendship(otherUserId: string) {
  const { error } = await supabase.rpc("end_friendship", {
    _other_user_id: otherUserId,
  });
  if (error) throw error;
}

/* ============ Gezieltes Teilen ============ */

export type ShareRow = {
  id: string;
  friendUserId: string;
  contentType: FriendContentType;
  contentId: string;
};

/** Freigaben für einen eigenen Inhalt (Rezept oder Zutat). */
export async function fetchSharesForContent(
  contentType: FriendContentType,
  contentId: string,
): Promise<ShareRow[]> {
  const { data, error } = await supabase
    .from("shared_with_friends")
    .select("id, friend_user_id, content_type, content_id")
    .eq("content_type", contentType)
    .eq("content_id", contentId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    friendUserId: r.friend_user_id,
    contentType: r.content_type as FriendContentType,
    contentId: r.content_id,
  }));
}

export const sharesForContentQuery = (
  contentType: FriendContentType,
  contentId: string,
) =>
  queryOptions({
    queryKey: ["shares", contentType, contentId],
    queryFn: () => fetchSharesForContent(contentType, contentId),
  });

/** Setzt die Freigaben eines Inhalts auf genau diese Freunde. */
export async function setShares(
  contentType: FriendContentType,
  contentId: string,
  friendUserIds: string[],
) {
  const { data: userRes } = await supabase.auth.getUser();
  const ownerId = userRes.user?.id;
  if (!ownerId) throw new Error("Nicht angemeldet");

  const existing = await fetchSharesForContent(contentType, contentId);
  const keep = new Set(friendUserIds);
  const toRemove = existing.filter((s) => !keep.has(s.friendUserId));
  const existingIds = new Set(existing.map((s) => s.friendUserId));
  const toAdd = friendUserIds.filter((id) => !existingIds.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("shared_with_friends")
      .delete()
      .in(
        "id",
        toRemove.map((s) => s.id),
      );
    if (error) throw error;
  }
  if (toAdd.length > 0) {
    const { error } = await supabase.from("shared_with_friends").insert(
      toAdd.map((friendId) => ({
        owner_user_id: ownerId,
        friend_user_id: friendId,
        content_type: contentType,
        content_id: contentId,
      })),
    );
    if (error) throw error;
  }
}

export async function removeShare(shareId: string) {
  const { error } = await supabase.from("shared_with_friends").delete().eq("id", shareId);
  if (error) throw error;
}

/** Inhalte, die ein Freund gezielt mit mir geteilt hat. */
export async function fetchSharedWithMe(ownerUserId: string): Promise<{
  recipes: RecipeListItem[];
  ingredients: CommunityIngredient[];
}> {
  const { data: userRes } = await supabase.auth.getUser();
  const me = userRes.user?.id;
  if (!me) return { recipes: [], ingredients: [] };

  const { data, error } = await supabase
    .from("shared_with_friends")
    .select("content_type, content_id")
    .eq("owner_user_id", ownerUserId)
    .eq("friend_user_id", me);
  if (error) throw error;

  const rows = data ?? [];
  const recipeIds = rows.filter((r) => r.content_type === "recipe").map((r) => r.content_id);
  const ingredientIds = rows
    .filter((r) => r.content_type === "ingredient")
    .map((r) => r.content_id);

  const [recipes, ingredients] = await Promise.all([
    fetchRecipesByIds(recipeIds),
    fetchIngredientsByIds(ingredientIds),
  ]);
  return { recipes, ingredients };
}

async function fetchIngredientsByIds(ids: string[]): Promise<CommunityIngredient[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("ingredients_master")
    .select("*, brand:brands(*)")
    .in("id", ids)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CommunityIngredient[];
}

export const sharedWithMeQuery = (ownerUserId: string) =>
  queryOptions({
    queryKey: ["shared_with_me", ownerUserId],
    queryFn: () => fetchSharedWithMe(ownerUserId),
    enabled: !!ownerUserId,
  });

/* ============ Benachrichtigungen ============ */

export type AcceptedNotification = {
  requestId: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  respondedAt: string | null;
};

/**
 * Eigene Anfragen, die angenommen wurden und noch nicht gesehen sind
 * (Bestätigungsmeldung für den Absender).
 */
export async function fetchAcceptedNotifications(): Promise<AcceptedNotification[]> {
  const { data: userRes } = await supabase.auth.getUser();
  const me = userRes.user?.id;
  if (!me) return [];

  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, receiver_id, responded_at")
    .eq("sender_id", me)
    .eq("status", "accepted")
    .is("sender_seen_at", null);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const profiles = await fetchAuthorProfiles(rows.map((r) => r.receiver_id));
  return rows.map((r) => {
    const p = profiles.get(r.receiver_id);
    return {
      requestId: r.id,
      userId: r.receiver_id,
      username: p?.username ?? "unbekannt",
      avatarUrl: p?.avatarUrl ?? null,
      respondedAt: r.responded_at,
    };
  });
}

export const acceptedNotificationsQuery = () =>
  queryOptions({
    queryKey: ["friends", "notifications", "accepted"],
    queryFn: fetchAcceptedNotifications,
  });

/** Markiert die Annahme-Meldung als gesehen. */
export async function markAcceptedSeen(requestId: string) {
  const { error } = await supabase
    .from("friend_requests")
    .update({ sender_seen_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw error;
}
