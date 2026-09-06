import { useUserRank } from "@/hooks/use-user-rank";

/**
 * Punkte-Sicht auf das Rang-System: Gesamtpunkte, heutige Punkte,
 * Tracking-Streak und aktiver Streak-Multiplikator.
 */
export function useUserPoints(options?: { sync?: boolean }) {
  const {
    totalPoints,
    todayPoints,
    currentStreakDays,
    streakMultiplier,
    series,
    isLoading,
  } = useUserRank(options);

  return {
    totalPoints,
    todayPoints,
    currentStreakDays,
    streakMultiplier,
    series,
    isLoading,
  };
}
