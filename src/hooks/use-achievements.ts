import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useTargetsForDate } from "@/hooks/use-targets-for-date";
import { useTracking } from "@/hooks/use-tracking";
import { bodyMeasurementsQuery } from "@/lib/bodyMeasurements";
import { addDays, toISODate } from "@/lib/meal-plan";
import type { Goal } from "@/lib/nutritionTargets";
import { buildProgressDays, dailyTotalsQuery, todayDate } from "@/lib/progress";
import {
  achievementStatsQuery,
} from "@/lib/achievement-stats";
import {
  achievementsQuery,
  evaluateAchievements,
  unlockAchievements,
  type AchievementState,
} from "@/lib/achievements";

/** Betrachtungsfenster für Serien und Abzeichen. */
const WINDOW_DAYS = 365;

/**
 * Abzeichen-Status inkl. Hintergrund-Freischaltung.
 * `sync: true` prüft neu erfüllte Bedingungen und zeigt einen Toast.
 */
export function useAchievements(options?: { sync?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { profile, targets, targetsFor } = useTargetsForDate();
  const { tracking } = useTracking();
  const notified = useRef<Set<string>>(new Set());
  const syncing = useRef(false);

  const end = useMemo(() => todayDate(), []);
  const start = useMemo(() => addDays(end, -(WINDOW_DAYS - 1)), [end]);
  const from = toISODate(start);
  const to = toISODate(end);

  const totalsQ = useQuery({ ...dailyTotalsQuery(from, to), enabled: !!user });
  const measQ = useQuery({ ...bodyMeasurementsQuery(), enabled: !!user });
  const rowsQ = useQuery({ ...achievementsQuery(), enabled: !!user });
  const statsQ = useQuery(achievementStatsQuery(user?.id));

  const days = useMemo(
    () => buildProgressDays(totalsQ.data ?? {}, start, end, targetsFor),
    [totalsQ.data, start, end, targetsFor],
  );

  const achievements = useMemo<AchievementState[]>(
    () =>
      evaluateAchievements(
        {
          days,
          measurements: measQ.data ?? [],
          goal: ((profile?.goal as Goal) ?? "maintain") as Goal,
          tracking,
          stats: statsQ.data,
        },
        rowsQ.data ?? [],
      ),
    [days, measQ.data, rowsQ.data, profile?.goal, tracking, statsQ.data],
  );

  const ready =
    !!user &&
    !totalsQ.isLoading &&
    !measQ.isLoading &&
    !rowsQ.isLoading &&
    !statsQ.isLoading &&
    !!rowsQ.data &&
    !!statsQ.data;

  useEffect(() => {
    if (!options?.sync || !ready || !user || syncing.current) return;
    const known = new Set((rowsQ.data ?? []).map((r) => r.achievement_key));
    const fresh = achievements.filter(
      (a) => a.unlocked && !known.has(a.definition.key),
    );
    if (fresh.length === 0) return;
    syncing.current = true;
    void unlockAchievements(
      user.id,
      fresh.map((a) => ({ key: a.definition.key, progress_value: a.value })),
    )
      .then(() => {
        for (const a of fresh) {
          if (notified.current.has(a.definition.key)) continue;
          notified.current.add(a.definition.key);
          toast.success(`Abzeichen freigeschaltet: ${a.title}`, {
            description: a.description,
          });
        }
        void qc.invalidateQueries({ queryKey: ["achievements"] });
      })
      .catch(() => {})
      .finally(() => {
        syncing.current = false;
      });
  }, [options?.sync, ready, achievements, rowsQ.data, user, qc]);

  return {
    achievements,
    days,
    targets,
    unlockedCount: achievements.filter((a) => a.unlocked).length,
    isLoading: !ready,
  };
}
