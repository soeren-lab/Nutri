import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTracking } from "@/hooks/use-tracking";
import { isTracked } from "@/lib/tracking";
import { addDays, toISODate } from "@/lib/meal-plan";
import { todayDate } from "@/lib/progress";
import {
  MACRO_LABELS,
  MACRO_POINTS,
  pointsLogQuery,
  type MacroKey,
  type PointsLogRow,
} from "@/lib/points";
import { RANK_THRESHOLDS, type RankTier } from "@/lib/ranks";

/** Betrachtungsfenster für die Statistik (Tage). */
const WINDOW_DAYS = 365;

export type RankHistoryEntry = {
  tier: RankTier;
  /** Datum (ISO), ab dem der Rang galt. */
  since: string;
  /** Datum (ISO), an dem der nächste Rang erreicht wurde (null = aktuell). */
  until: string | null;
  /** Dauer in Tagen (null = aktuell aktiv). */
  days: number | null;
  isCurrent: boolean;
};

export type PointsSourceEntry = {
  key: string;
  label: string;
  points: number;
};

export type RankStatistics = {
  history: RankHistoryEntry[];
  /** Ø Punkte/Tag im gewählten Zeitraum. */
  average: number;
  /** Ø Punkte/Tag im davorliegenden Zeitraum. */
  previousAverage: number;
  /** Differenz zum vorherigen Zeitraum. */
  averageDelta: number;
  bestDay: { date: string; points: number } | null;
  sources: PointsSourceEntry[];
  /** Punktesumme im gewählten Zeitraum. */
  rangeTotal: number;
  /** Geschätzte Tage bis zum nächsten Rang (null = keine Prognose). */
  daysToNextRank: number | null;
  nextRank: RankTier | null;
  /** Anzahl Tage mit Protokoll-Eintrag im gewählten Zeitraum. */
  loggedDays: number;
  totalPoints: number;
  isLoading: boolean;
};

type Breakdown = {
  hits?: Partial<Record<MacroKey, boolean>>;
  scores?: Partial<Record<MacroKey, number>>;
  base_points?: number;
  bonus_points?: number;
  milestone_bonus?: number;
  multiplier?: number;
  late_factor?: number;
};

function readBreakdown(row: PointsLogRow): Breakdown {
  const b = row.breakdown;
  return b && typeof b === "object" && !Array.isArray(b) ? (b as Breakdown) : {};
}

/** Anteil eines Makros an den Basispunkten des Tages (0–1). */
function macroShare(b: Breakdown, key: MacroKey): number {
  if (b.scores && typeof b.scores[key] === "number") return b.scores[key]!;
  return b.hits?.[key] ? 1 : 0;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00`).getTime();
  const c = new Date(`${toIso}T00:00:00`).getTime();
  return Math.max(0, Math.round((c - a) / 86_400_000));
}

/**
 * Rang- und Punkte-Statistiken auf Basis des vorhandenen `points_log`:
 * Aufstiegs-Historie, Ø Punkte/Tag mit Trend, bester Tag,
 * Punkte-Herkunft und Prognose bis zum nächsten Rang.
 */
export function useRankStatistics(rangeDays: 7 | 30 = 7): RankStatistics {
  const { user } = useAuth();
  const end = useMemo(() => todayDate(), []);
  const from = useMemo(() => toISODate(addDays(end, -(WINDOW_DAYS - 1))), [end]);
  const to = useMemo(() => toISODate(end), [end]);

  const { tracking } = useTracking();
  const logQ = useQuery({ ...pointsLogQuery(from, to), enabled: !!user });
  const rows = logQ.data ?? [];

  return useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const totalPoints = sorted.reduce((s, r) => s + (r.points_earned ?? 0), 0);

    /* --- 1. Rang-Aufstiegs-Historie ------------------------------------ */
    const reached: { tier: RankTier; date: string }[] = [];
    let cumulative = 0;
    let nextIndex = 1; // Bronze 1 gilt ab Start
    for (const row of sorted) {
      cumulative += row.points_earned ?? 0;
      while (
        nextIndex < RANK_THRESHOLDS.length &&
        cumulative >= RANK_THRESHOLDS[nextIndex]!.points
      ) {
        reached.push({ tier: RANK_THRESHOLDS[nextIndex]!, date: row.date });
        nextIndex++;
      }
    }
    if (sorted.length > 0) {
      reached.unshift({ tier: RANK_THRESHOLDS[0]!, date: sorted[0]!.date });
    }
    const history: RankHistoryEntry[] = reached
      .map((entry, i) => {
        const next = reached[i + 1] ?? null;
        return {
          tier: entry.tier,
          since: entry.date,
          until: next?.date ?? null,
          days: next ? Math.max(1, daysBetween(entry.date, next.date)) : null,
          isCurrent: !next,
        };
      })
      .reverse();

    /* --- 2. Ø Punkte/Tag mit Trend ------------------------------------- */
    const rangeStart = toISODate(addDays(end, -(rangeDays - 1)));
    const prevStart = toISODate(addDays(end, -(rangeDays * 2 - 1)));
    const inRange = sorted.filter((r) => r.date >= rangeStart && r.date <= to);
    const inPrev = sorted.filter((r) => r.date >= prevStart && r.date < rangeStart);
    const rangeTotal = inRange.reduce((s, r) => s + (r.points_earned ?? 0), 0);
    const prevTotal = inPrev.reduce((s, r) => s + (r.points_earned ?? 0), 0);
    const average = Math.round(rangeTotal / rangeDays);
    const previousAverage = Math.round(prevTotal / rangeDays);

    /* --- 3. Bester Tag ------------------------------------------------- */
    const best = sorted.reduce<PointsLogRow | null>(
      (acc, r) => (!acc || (r.points_earned ?? 0) > (acc.points_earned ?? 0) ? r : acc),
      null,
    );

    /* --- 4. Punkte-Herkunft ------------------------------------------- */
    const macroSums: Record<MacroKey, number> = {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
    };
    let bonusSum = 0;
    let milestoneSum = 0;
    for (const row of inRange) {
      const b = readBreakdown(row);
      const factor = (b.multiplier ?? 1) * (b.late_factor ?? 1);
      for (const key of Object.keys(macroSums) as MacroKey[]) {
        macroSums[key] += macroShare(b, key) * MACRO_POINTS[key] * factor;
      }
      bonusSum += (b.bonus_points ?? 0) * factor;
      milestoneSum += b.milestone_bonus ?? 0;
    }
    const sources: PointsSourceEntry[] = [
      ...(Object.keys(macroSums) as MacroKey[])
        .filter((key) => isTracked(tracking, key))
        .map((key) => ({
        key,
        label: MACRO_LABELS[key],
          points: Math.round(macroSums[key]),
        })),
      { key: "all_five", label: "Komplett-Bonus", points: Math.round(bonusSum) },
      { key: "milestone", label: "Streak-Meilensteine", points: Math.round(milestoneSum) },
    ].filter((s) => s.points > 0);

    /* --- 5. Prognose --------------------------------------------------- */
    const last7Start = toISODate(addDays(end, -6));
    const last7 = sorted.filter((r) => r.date >= last7Start);
    const avg7 = last7.reduce((s, r) => s + (r.points_earned ?? 0), 0) / 7;
    let index = 0;
    for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
      if (totalPoints >= RANK_THRESHOLDS[i]!.points) index = i;
    }
    const nextRank = RANK_THRESHOLDS[index + 1] ?? null;
    const enoughHistory = last7.length >= 3 && avg7 > 0;
    const daysToNextRank =
      nextRank && enoughHistory
        ? Math.max(1, Math.ceil((nextRank.points - totalPoints) / avg7))
        : null;

    return {
      history,
      average,
      previousAverage,
      averageDelta: average - previousAverage,
      bestDay: best
        ? { date: best.date, points: best.points_earned ?? 0 }
        : null,
      sources,
      rangeTotal,
      daysToNextRank,
      nextRank,
      loggedDays: inRange.length,
      totalPoints,
      isLoading: logQ.isLoading,
    };
  }, [rows, rangeDays, end, to, logQ.isLoading, tracking]);
}
