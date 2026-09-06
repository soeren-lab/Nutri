import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarSignedUrls } from "@/lib/avatar";

/** Vergleichswerte eines Nutzers (ich oder Freund) für die Leaderboards. */
export type ComparisonEntry = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalPoints: number;
  currentStreakDays: number;
  weekAvgPoints: number;
  weekDays: number;
  achievementCount: number;
  isSelf: boolean;
};

export async function fetchFriendComparison(): Promise<ComparisonEntry[]> {
  const { data, error } = await supabase.rpc("get_friend_comparison");
  if (error) throw error;
  const rows = data ?? [];
  const avatars = await getAvatarSignedUrls(
    rows.map((r) => r.avatar_url).filter((p): p is string => !!p),
  );
  return rows.map((r) => ({
    userId: r.user_id,
    username: r.username ?? "du",
    avatarUrl: r.avatar_url ? (avatars.get(r.avatar_url) ?? null) : null,
    totalPoints: r.total_points ?? 0,
    currentStreakDays: r.current_streak_days ?? 0,
    weekAvgPoints: Number(r.week_avg_points ?? 0),
    weekDays: r.week_days ?? 0,
    achievementCount: r.achievement_count ?? 0,
    isSelf: !!r.is_self,
  }));
}

export const friendComparisonQuery = () =>
  queryOptions({
    queryKey: ["friends", "comparison"],
    queryFn: fetchFriendComparison,
    staleTime: 60_000,
  });
