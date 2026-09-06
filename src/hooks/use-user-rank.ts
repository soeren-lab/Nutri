import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useTargetsForDate } from "@/hooks/use-targets-for-date";
import { useTracking } from "@/hooks/use-tracking";
import { toISODate } from "@/lib/meal-plan";
import {
  buildTrackingResolver,
  computePointsSeries,
  multiplierForStreak,
  pointsLogQuery,
  syncPoints,
  userPointsQuery,
} from "@/lib/points";
import { dailyTotalsQuery, todayDate } from "@/lib/progress";
import { rankForPoints } from "@/lib/ranks";
import { currentSeasonQuery } from "@/lib/seasons";

/** Alle Tage von `from` bis `to` (inklusive) als ISO-Strings. */
function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to && out.length < 400) {
    out.push(cur);
    const [y, m, d] = cur.split("-").map(Number) as [number, number, number];
    cur = toISODate(new Date(y, m - 1, d + 1));
  }
  return out;
}

/**
 * Rang, Punkte und Punkte-Verlauf der laufenden Season – es gibt nur noch
 * diesen einen Rang, er startet mit jeder Season neu.
 * `sync: true` schreibt abgeschlossene Tage ins Protokoll und aktualisiert
 * den Punktestand.
 */
export function useUserRank(options?: { sync?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { targetsFor } = useTargetsForDate();
  const { tracking } = useTracking();
  const syncing = useRef(false);
  const notifiedRank = useRef<string | null>(null);

  const today = useMemo(() => toISODate(todayDate()), []);
  const seasonQ = useQuery({ ...currentSeasonQuery(), enabled: !!user });
  const season = seasonQ.data ?? null;

  const from = season?.start_date ?? today;
  const to = season && season.end_date < today ? season.end_date : today;

  const totalsQ = useQuery({
    ...dailyTotalsQuery(from, to),
    enabled: !!user && !!season,
  });
  const pointsQ = useQuery({ ...userPointsQuery(), enabled: !!user });
  const logQ = useQuery({
    ...pointsLogQuery(from, to),
    enabled: !!user && !!season,
  });

  const dates = useMemo(() => (season ? dateRange(from, to) : []), [season, from, to]);

  /**
   * Bereits protokollierte Tage behalten die Kategorien, die bei ihrer
   * Berechnung aktiv waren – Toggle-Änderungen wirken nur ab heute.
   */
  const trackingFor = useMemo(
    () => buildTrackingResolver(logQ.data ?? [], tracking),
    [logQ.data, tracking],
  );

  const series = useMemo(
    () => computePointsSeries(dates, totalsQ.data ?? {}, targetsFor, trackingFor),
    [dates, totalsQ.data, targetsFor, trackingFor],
  );

  /** Nur abgeschlossene Tage zählen für den Punktestand. */
  const completedSeries = useMemo(
    () => series.filter((d) => d.date < today),
    [series, today],
  );

  /** Aus dem Protokoll abgeleitete Punkte (ohne manuelle Boni). */
  const earnedPoints = useMemo(
    () => completedSeries.reduce((sum, d) => sum + d.points, 0),
    [completedSeries],
  );

  /** Manuell gutgeschriebene Bonuspunkte (bleiben bei Neuberechnungen erhalten). */
  const bonusPoints = pointsQ.data?.bonus_points ?? 0;

  const totalPoints = earnedPoints + bonusPoints;

  const todayPoints = series.find((d) => d.date === today)?.points ?? 0;
  // Tracking-Streak: ein heute noch leerer Tag beendet die Serie nicht.
  const currentStreakDays =
    series[series.length - 1]?.streakDays ||
    series[series.length - 2]?.streakDays ||
    0;
  const streakMultiplier = multiplierForStreak(currentStreakDays);

  const rank = useMemo(() => rankForPoints(totalPoints), [totalPoints]);

  const daysLeft = season
    ? Math.max(
        0,
        Math.round(
          (new Date(`${season.end_date}T00:00:00`).getTime() -
            new Date(`${today}T00:00:00`).getTime()) /
            86400000,
        ),
      )
    : 0;

  const ready =
    !!user &&
    !!season &&
    !seasonQ.isLoading &&
    !totalsQ.isLoading &&
    !pointsQ.isLoading &&
    !logQ.isLoading &&
    !!logQ.data;

  useEffect(() => {
    if (!options?.sync || !ready || !user || !season || syncing.current) return;
    const stored = pointsQ.data?.total_points ?? 0;
    if (stored === earnedPoints) return;
    syncing.current = true;
    void syncPoints(user.id, completedSeries, season.id)
      .then(() => {
        const before = rankForPoints(stored + bonusPoints).current;
        const after = rankForPoints(totalPoints).current;
        if (after.key !== before.key && notifiedRank.current !== after.key) {
          notifiedRank.current = after.key;
          toast.success(`Neuer Rang: ${after.label}`, {
            description: `${totalPoints} Punkte in dieser Season`,
          });
        }
        void qc.invalidateQueries({ queryKey: ["user-points"] });
        void qc.invalidateQueries({ queryKey: ["points-log"] });
        void qc.invalidateQueries({ queryKey: ["season-comparison"] });
      })
      .catch(() => {})
      .finally(() => {
        syncing.current = false;
      });
  }, [
    options?.sync,
    ready,
    user,
    season,
    totalPoints,
    earnedPoints,
    bonusPoints,
    completedSeries,
    pointsQ.data,
    qc,
  ]);

  return {
    season,
    rank,
    totalPoints,
    todayPoints,
    currentStreakDays,
    streakMultiplier,
    daysLeft,
    series,
    isLoading: !ready,
  };
}
