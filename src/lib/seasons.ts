import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Dauer einer Season in Tagen. */
export const SEASON_LENGTH_DAYS = 70;

export type Season = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  season_number: number | null;
  is_active?: boolean;
};

export type SeasonHistoryRow = {
  id: string;
  season_id: string;
  final_points: number;
  final_rank: string | null;
  final_placement_among_friends: number | null;
  season: Season | null;
};

/* ------------------------------------------------------------- Datenzugriff */

/**
 * Liefert die laufende Season und startet bei Ablauf automatisch die nächste
 * (inkl. Historien-Einträgen für die abgelaufene Season).
 */
export async function ensureCurrentSeason(): Promise<Season | null> {
  const { data, error } = await supabase.rpc("ensure_current_season");
  if (error) throw error;
  const row = (data ?? [])[0];
  return row ? (row as Season) : null;
}

export const currentSeasonQuery = () =>
  queryOptions({
    queryKey: ["current-season"],
    queryFn: ensureCurrentSeason,
    staleTime: 5 * 60_000,
  });

export type SeasonLogRow = { date: string; points_earned: number };

export async function fetchSeasonLog(seasonId: string): Promise<SeasonLogRow[]> {
  const { data, error } = await supabase
    .from("points_log")
    .select("date, points_earned")
    .eq("season_id", seasonId)
    .order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export const seasonLogQuery = (seasonId: string | undefined) =>
  queryOptions({
    queryKey: ["season-points-log", seasonId],
    queryFn: () => fetchSeasonLog(seasonId!),
    staleTime: 30_000,
    enabled: !!seasonId,
  });

export async function fetchSeasonHistory(): Promise<SeasonHistoryRow[]> {
  const { data, error } = await supabase
    .from("season_history")
    .select(
      "id, season_id, final_points, final_rank, final_placement_among_friends, season:seasons(id, name, start_date, end_date, season_number)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SeasonHistoryRow[];
}

export const seasonHistoryQuery = () =>
  queryOptions({
    queryKey: ["season-history"],
    queryFn: fetchSeasonHistory,
    staleTime: 5 * 60_000,
  });

/* ---------------------------------------------------------- Start-Screen */

export async function fetchSeasonSeen(seasonId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_seen_seasons")
    .select("season_id")
    .eq("season_id", seasonId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export const seasonSeenQuery = (seasonId: string | undefined) =>
  queryOptions({
    queryKey: ["season-seen", seasonId],
    queryFn: () => fetchSeasonSeen(seasonId!),
    staleTime: 60_000,
    enabled: !!seasonId,
  });

export async function markSeasonSeen(userId: string, seasonId: string): Promise<void> {
  const { error } = await supabase
    .from("user_seen_seasons")
    .upsert({ user_id: userId, season_id: seasonId }, { onConflict: "user_id,season_id" });
  if (error) throw error;
}

/* ------------------------------------------------------- Freunde-Vergleich */

export type SeasonComparisonEntry = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  points: number;
  streakDays: number;
  rankKey?: string | null;
  isSelf: boolean;
};

export async function fetchSeasonComparison(
  seasonId: string,
): Promise<SeasonComparisonEntry[]> {
  const { data, error } = await supabase.rpc("get_friend_season_comparison", {
    _season_id: seasonId,
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url,
    points: r.total_points,
    streakDays: r.current_streak_days,
    isSelf: r.is_self,
  }));
}

export const seasonComparisonQuery = (seasonId: string | undefined) =>
  queryOptions({
    queryKey: ["season-comparison", seasonId],
    queryFn: () => fetchSeasonComparison(seasonId!),
    staleTime: 60_000,
    enabled: !!seasonId,
  });

export async function fetchSeasonHistoryComparison(
  seasonId: string,
): Promise<SeasonComparisonEntry[]> {
  const { data, error } = await supabase.rpc("get_friend_season_history", {
    _season_id: seasonId,
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url,
    points: r.final_points,
    streakDays: 0,
    rankKey: r.final_rank,
    isSelf: r.is_self,
  }));
}

export const seasonHistoryComparisonQuery = (seasonId: string | undefined) =>
  queryOptions({
    queryKey: ["season-history-comparison", seasonId],
    queryFn: () => fetchSeasonHistoryComparison(seasonId!),
    staleTime: 60_000,
    enabled: !!seasonId,
  });
