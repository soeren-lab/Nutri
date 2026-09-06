import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { computeTargets, fetchUserProfile, type NutritionTargets } from "@/lib/nutritionTargets";
import {
  asTargetsResolver,
  buildTargetsResolver,
  fetchTargetHistory,
  type TargetsForDate,
} from "@/lib/targetHistory";
import {
  DEFAULT_TRACKING,
  isTracked,
  trackingFromProfile,
  type TrackingSettings,
} from "@/lib/tracking";
import {
  TARGET_MAX,
  TARGET_MIN,
  fetchDailyTotals,
  type DayTotals,
} from "@/lib/progress";


export type PointsLogRow = Tables<"points_log">;
export type UserPointsRow = Tables<"user_points">;

/** Volle Punkte pro Nährwert bei vollem Treffer (Summe = 300). */
export const MACRO_POINTS: Record<
  "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g",
  number
> = {
  calories: 90,
  protein_g: 75,
  carbs_g: 45,
  fat_g: 45,
  fiber_g: 45,
};
/** Legacy-Alias (Kalorien-Gewichtung). */
export const POINTS_PER_HIT = MACRO_POINTS.calories;
/** Bonus, wenn alle fünf Werte am selben Tag voll getroffen sind. */
export const ALL_FIVE_BONUS = 150;
/** Legacy-Alias (früher 4er-Bonus). */
export const ALL_FOUR_BONUS = ALL_FIVE_BONUS;
/** Anzahl bewerteter Nährwert-Kategorien. */
export const MACRO_COUNT = 5;

/** Streak-Multiplikatoren (ab X Tagen in Folge mit Eintrag). */
export const STREAK_MULTIPLIERS: { days: number; factor: number }[] = [
  { days: 14, factor: 1.3 },
  { days: 7, factor: 1.2 },
  { days: 3, factor: 1.1 },
];

/** Einmalige Meilenstein-Boni pro Streak-Lauf. */
export const STREAK_MILESTONES: { days: number; bonus: number }[] = [
  { days: 7, bonus: 100 },
  { days: 30, bonus: 300 },
  { days: 100, bonus: 1000 },
];

/**
 * Nachtrage-Fenster: Faktor je Verspätung in Tagen (Index = days_late).
 * Ab Tag 6 gibt es keine Punkte mehr für den Tag – der Streak bleibt.
 */
export const LATE_FACTORS = [1, 0.8, 0.6, 0.4, 0.2, 0.1] as const;
/** Letzter Tag, an dem noch Punkte nachgetragen werden können. */
export const LATE_WINDOW_DAYS = LATE_FACTORS.length - 1;

/** Punkte-Faktor für einen nachgetragenen Tag (0 = zu spät). */
export function lateFactorForDays(daysLate: number): number {
  if (daysLate <= 0) return 1;
  return LATE_FACTORS[daysLate] ?? 0;
}

/** Anzahl Tage zwischen Eintrags-Datum und heute (0 = heute). */
export function daysLateFor(date: Date | string, today: Date = new Date()): number {
  const iso = typeof date === "string" ? date : toISODateLocal(date);
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const entry = new Date(y, m - 1, d);
  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((ref.getTime() - entry.getTime()) / 86_400_000);
  return Math.max(0, diff);
}

function toISODateLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Hinweistext für den Nachtrag eines vergangenen Tages
 * (null = heutiger Tag, kein Abschlag).
 */
export function lateNoticeFor(date: Date | string, today?: Date): string | null {
  const daysLate = daysLateFor(date, today);
  if (daysLate <= 0) return null;
  const factor = lateFactorForDays(daysLate);
  const dayLabel = daysLate === 1 ? "1 Tag" : `${daysLate} Tage`;
  if (factor <= 0) return "Zu spät für Punkte, zählt aber weiter für deinen Streak";
  return `Nachtrag (${dayLabel} später) – nur ${Math.round(factor * 100)} % der Punkte für diesen Tag möglich`;
}

export type MacroKey = "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g";

export const MACRO_LABELS: Record<MacroKey, string> = {
  calories: "Kalorien",
  protein_g: "Protein",
  carbs_g: "Kohlenhydrate",
  fat_g: "Fett",
  fiber_g: "Ballaststoffe",
};

export type PointsBreakdown = {
  /** Welche Werte lagen im Zielkorridor (voller Treffer)? */
  hits: Record<MacroKey, boolean>;
  /** Anteil der vollen Punkte pro Wert (1 / 0.6 / 0.3 / 0). */
  scores: Record<MacroKey, number>;
  basePoints: number;
  bonusPoints: number;
  /** Angewendeter Streak-Multiplikator (1 = keiner). */
  multiplier: number;
  /** Ob ein Streak-Bonus (Multiplikator > 1) griff. */
  streakBonus: boolean;
  streakDays: number;
  /** Einmaliger Meilenstein-Bonus an diesem Tag (0 = keiner). */
  milestoneBonus: number;
  /** Späteste Nachtragung unter den Einträgen dieses Tages (0 = am selben Tag). */
  daysLate: number;
  /** Abschlag-Faktor aus dem Nachtrage-Fenster (1 = kein Abschlag, 0 = zu spät). */
  lateFactor: number;
  /** Tracking-Einstellungen, mit denen dieser Tag berechnet wurde. */
  tracking: TrackingSettings;
  points: number;
};

export type DayPoints = { date: string } & PointsBreakdown;

function inCorridor(value: number, target: number): boolean {
  if (!target || target <= 0 || value <= 0) return false;
  const ratio = value / target;
  return ratio >= TARGET_MIN && ratio <= TARGET_MAX;
}

/**
 * Gestaffelte Teilpunkte: 80–110 % voll, 70–79 % / 111–125 % 60 %,
 * 50–69 % / 126–150 % 30 %, darüber/darunter 0.
 */
export function macroScore(value: number, target: number): number {
  if (!target || target <= 0 || value <= 0) return 0;
  const ratio = value / target;
  if (ratio >= TARGET_MIN && ratio <= TARGET_MAX) return 1;
  if (ratio >= 0.7 && ratio < TARGET_MIN) return 0.6;
  if (ratio > TARGET_MAX && ratio <= 1.25) return 0.6;
  if (ratio >= 0.5 && ratio < 0.7) return 0.3;
  if (ratio > 1.25 && ratio <= 1.5) return 0.3;
  return 0;
}

/**
 * Protein: Überschreitung wird nicht bestraft – ab 100 % des Ziels
 * gibt es volle Punkte, Unterschreitung wird gestaffelt bewertet.
 */
/**
 * Ballaststoffe: gleiche Sonderregel wie Protein – Überschreitung wird nicht
 * bestraft, nur Unterschreitung gestaffelt reduziert.
 */
export function fiberScore(value: number, target: number): number {
  return proteinScore(value, target);
}

export function proteinScore(value: number, target: number): number {
  if (!target || target <= 0 || value <= 0) return 0;
  const ratio = value / target;
  if (ratio >= 1) return 1;
  if (ratio >= TARGET_MIN) return 1;
  if (ratio >= 0.7) return 0.6;
  if (ratio >= 0.5) return 0.3;
  return 0;
}

export function multiplierForStreak(streakDays: number): number {
  return STREAK_MULTIPLIERS.find((m) => streakDays >= m.days)?.factor ?? 1;
}
/** Gewichtung eines Punktesystems (Lifetime oder Season). */
export type PointsWeights = {
  macro: Record<MacroKey, number>;
  /** Bonus, wenn alle aktiven Kategorien voll getroffen sind. */
  bonus: number;
  /** Einmalige Streak-Meilensteine (leer = keine). */
  milestones: { days: number; bonus: number }[];
};

/** Bestehende Lifetime-Gewichtung – unverändert. */
export const LIFETIME_WEIGHTS: PointsWeights = {
  macro: MACRO_POINTS,
  bonus: ALL_FIVE_BONUS,
  milestones: STREAK_MILESTONES,
};


/**
 * Punkte eines Tages: pro Nährwert gestaffelte Teilpunkte (Kalorien 30,
 * Protein 25, KH 15, Fett 15, Ballaststoffe 15), +50 Bonus bei fünf vollen
 * Treffern (max. 150 Basis), darauf der Streak-Multiplikator.
 * Hinweis: Das Tagesmaximum ist von ~182 auf ~195 Punkte gestiegen – die
 * Balance der RANK_THRESHOLDS sollte ggf. neu geprüft werden.
 * Der Streak zählt Tage mit mindestens einem Planer-Eintrag – zusätzlich
 * gibt es einmalige Meilenstein-Boni bei 7/30/100 Tagen.
 */
export function calculateDailyPoints(
  totals: DayTotals | undefined,
  targets: NutritionTargets | null,
  /** Serie an Vortagen mit Eintrag (für den Multiplikator). */
  priorStreakDays: number,
  /** Wurde an diesem Tag mindestens ein Eintrag geloggt? */
  hasEntry = totals != null,
  /**
   * Individuelle Tracking-Einstellungen: deaktivierte Kategorien werden
   * komplett ignoriert (keine Punkte, aber auch kein Abzug).
   */
  tracking: TrackingSettings = DEFAULT_TRACKING,
  /**
   * Gewichtung der Punkte. Default = Lifetime-Skala; Seasons nutzen eigene
   * Werte, ohne die Lifetime-Berechnung zu verändern.
   */
  weights: PointsWeights = LIFETIME_WEIGHTS,
): PointsBreakdown {
  const rawScores: Record<MacroKey, number> = {
    calories: macroScore(totals?.calories ?? 0, targets?.calories ?? 0),
    protein_g: proteinScore(totals?.protein_g ?? 0, targets?.protein_g ?? 0),
    carbs_g: macroScore(totals?.carbs_g ?? 0, targets?.carbs_g ?? 0),
    fat_g: macroScore(totals?.fat_g ?? 0, targets?.fat_g ?? 0),
    fiber_g: fiberScore(totals?.fiber_g ?? 0, targets?.fiber_g ?? 0),
  };
  const activeKeys = (Object.keys(rawScores) as MacroKey[]).filter((key) =>
    isTracked(tracking, key),
  );
  const scores = { ...rawScores };
  for (const key of Object.keys(scores) as MacroKey[]) {
    if (!activeKeys.includes(key)) scores[key] = 0;
  }
  const rawHits: Record<MacroKey, boolean> = {
    calories: inCorridor(totals?.calories ?? 0, targets?.calories ?? 0),
    protein_g: rawScores.protein_g === 1,
    carbs_g: inCorridor(totals?.carbs_g ?? 0, targets?.carbs_g ?? 0),
    fat_g: inCorridor(totals?.fat_g ?? 0, targets?.fat_g ?? 0),
    fiber_g: rawScores.fiber_g === 1,
  };
  const hits = { ...rawHits };
  for (const key of Object.keys(hits) as MacroKey[]) {
    if (!activeKeys.includes(key)) hits[key] = false;
  }
  const fullCount = activeKeys.filter((key) => scores[key] === 1).length;
  const basePoints = Math.round(
    activeKeys.reduce((sum, key) => sum + scores[key] * weights.macro[key], 0),
  );
  // Bonus bezieht sich nur auf die aktiven Kategorien.
  const bonusPoints =
    activeKeys.length > 0 && fullCount === activeKeys.length ? weights.bonus : 0;

  const streakDays = hasEntry ? priorStreakDays + 1 : 0;
  const multiplier = multiplierForStreak(streakDays);
  const milestoneBonus =
    weights.milestones.find((m) => m.days === streakDays)?.bonus ?? 0;

  // Nachtrage-Fenster: der späteste Nachtrag des Tages bestimmt den Abschlag.
  const daysLate = totals?.daysLate ?? 0;
  const lateFactor = lateFactorForDays(daysLate);
  return {
    hits,
    scores,
    basePoints,
    bonusPoints,
    multiplier,
    streakBonus: multiplier > 1,
    streakDays,
    milestoneBonus,
    daysLate,
    lateFactor,
    tracking,
    points:
      Math.round((basePoints + bonusPoints) * multiplier * lateFactor) + milestoneBonus,
  };
}

/** Alias für Rückwärtskompatibilität. */
export const computeDayPoints = calculateDailyPoints;

/** Auflöser: liefert die am jeweiligen Datum gültigen Tracking-Einstellungen. */
export type TrackingForDate = (dateIso: string) => TrackingSettings;

function asTrackingResolver(
  tracking: TrackingSettings | TrackingForDate,
): TrackingForDate {
  return typeof tracking === "function" ? tracking : () => tracking;
}

/**
 * Liest die Tracking-Einstellungen, die bei der ursprünglichen Berechnung
 * eines Protokoll-Tages gültig waren (null = nicht gespeichert).
 */
export function trackingFromLogRow(row: PointsLogRow): TrackingSettings | null {
  const b = row.breakdown;
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const raw = (b as { tracking?: unknown }).tracking;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const t = raw as Partial<Record<keyof TrackingSettings, boolean>>;
  return {
    calories: true,
    protein_g: t.protein_g ?? true,
    carbs_g: t.carbs_g ?? true,
    fat_g: t.fat_g ?? true,
    fiber_g: t.fiber_g ?? true,
    sugar_g: t.sugar_g ?? true,
  };
}

/**
 * Tracking-Auflöser mit historischer Treue: bereits protokollierte Tage
 * behalten die damals aktiven Kategorien, alle übrigen Tage (heute, Zukunft,
 * noch nie berechnete Tage) nutzen die aktuellen Einstellungen.
 */
export function buildTrackingResolver(
  rows: PointsLogRow[],
  current: TrackingSettings,
): TrackingForDate {
  const byDate = new Map<string, TrackingSettings>();
  for (const row of rows) {
    const stored = trackingFromLogRow(row);
    if (stored) byDate.set(row.date, stored);
  }
  return (date) => byDate.get(date) ?? current;
}

/**
 * Punkte-Verlauf für eine chronologische Tagesliste inkl. Streak-Ketten.
 */
export function computePointsSeries(
  dates: string[],
  totals: Record<string, DayTotals>,
  /** Ziel-Werte oder ein Auflöser für die je Tag gültigen Ziel-Werte. */
  targets: NutritionTargets | null | TargetsForDate,
  /**
   * Tracking-Einstellungen oder ein Auflöser für die je Tag gültigen
   * Einstellungen (Default: alle Kategorien aktiv).
   */
  tracking: TrackingSettings | TrackingForDate = DEFAULT_TRACKING,
  /** Gewichtung (Default: Lifetime). */
  weights: PointsWeights = LIFETIME_WEIGHTS,
): DayPoints[] {
  const resolve = asTargetsResolver(targets);
  const resolveTracking = asTrackingResolver(tracking);
  const out: DayPoints[] = [];
  let streak = 0;
  for (const date of dates) {
    const b = calculateDailyPoints(
      date in totals ? totals[date] : undefined,
      resolve(date),
      streak,
      undefined,
      resolveTracking(date),
      weights,
    );

    streak = b.streakDays;
    out.push({ date, ...b });
  }
  return out;
}



/* ------------------------------------------------------------- Datenzugriff */

export async function fetchUserPoints(): Promise<UserPointsRow | null> {
  const { data, error } = await supabase
    .from("user_points")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export const userPointsQuery = () =>
  queryOptions({
    queryKey: ["user-points"],
    queryFn: fetchUserPoints,
    staleTime: 30_000,
  });

export async function fetchPointsLog(from: string, to: string): Promise<PointsLogRow[]> {
  const { data, error } = await supabase
    .from("points_log")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export const pointsLogQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["points-log", from, to],
    queryFn: () => fetchPointsLog(from, to),
    staleTime: 30_000,
  });

/**
 * Schreibt abgeschlossene Tage (bis einschließlich gestern) ins Punkte-Protokoll
 * und aktualisiert die Gesamtpunkte sowie die Punkte-Streak.
 *
 * Tage, die nach einer Änderung (Eintrag gelöscht/geändert) keine Punkte mehr
 * ergeben, werden aus dem Protokoll entfernt – so bleiben keine veralteten
 * Punkte in den Gesamtpunkten stehen.
 */
export async function syncPoints(
  userId: string,
  series: DayPoints[],
  /** Laufende Season – jeder Protokoll-Eintrag wird ihr zugeordnet. */
  seasonId?: string | null,
): Promise<{ inserted: number; totalPoints: number }> {
  const completed = series.filter((d) => d.points > 0);
  if (completed.length > 0) {
    const { error } = await supabase.from("points_log").upsert(
      completed.map((d) => ({
        user_id: userId,
        season_id: seasonId ?? null,
        date: d.date,
        points_earned: d.points,
        days_late: d.daysLate,
        points_multiplier_applied: Math.round(d.multiplier * d.lateFactor * 100) / 100,
        breakdown: {
          hits: d.hits,
          base_points: d.basePoints,
          bonus_points: d.bonusPoints,
          multiplier: d.multiplier,
          streak_bonus: d.streakBonus,
          streak_days: d.streakDays,
          milestone_bonus: d.milestoneBonus,
          days_late: d.daysLate,
          late_factor: d.lateFactor,
          // Historische Treue: mit diesen Kategorien wurde der Tag berechnet.
          tracking: d.tracking,
        },
      })),
      { onConflict: "user_id,date" },
    );
    if (error) throw error;
  }

  // Veraltete Protokoll-Einträge im betrachteten Zeitraum aufräumen
  // (z. B. wenn ein Eintrag nachträglich gelöscht oder geändert wurde).
  const zeroDates = series.filter((d) => d.points <= 0).map((d) => d.date);
  for (let i = 0; i < zeroDates.length; i += 50) {
    const chunk = zeroDates.slice(i, i + 50);
    const { error: delErr } = await supabase
      .from("points_log")
      .delete()
      .eq("user_id", userId)
      .in("date", chunk);
    if (delErr) throw delErr;
  }



  const totalPoints = completed.reduce((sum, d) => sum + d.points, 0);
  const last = completed[completed.length - 1] ?? null;
  // Die Tracking-Streak richtet sich nach dem letzten betrachteten Tag,
  // nicht nach dem letzten Tag mit Punkten.
  const streakDays = series[series.length - 1]?.streakDays ?? 0;
  const { error: upErr } = await supabase.from("user_points").upsert(
    {
      user_id: userId,
      total_points: totalPoints,
      current_streak_days: streakDays,
      last_points_date: last?.date ?? null,
      ...(seasonId ? { current_season_id: seasonId } : {}),
    },
    { onConflict: "user_id" },
  );
  if (upErr) throw upErr;
  return { inserted: completed.length, totalPoints };
}

/* --------------------------------------------------------------- Season */

export type ActiveSeason = { id: string; start_date: string; end_date: string };

/**
 * Laufende Season (legt bei Ablauf automatisch die nächste an).
 * Lokal definiert, um einen Import-Zyklus mit `@/lib/seasons` zu vermeiden.
 */
export async function fetchActiveSeason(): Promise<ActiveSeason | null> {
  const { data, error } = await supabase.rpc("ensure_current_season");
  if (error) throw error;
  const row = (data ?? [])[0];
  return row ? { id: row.id, start_date: row.start_date, end_date: row.end_date } : null;
}

/* ------------------------------------------------- Nachträgliche Korrektur */

/** Betrachtungsfenster für Neuberechnungen (Tage). */
export const RECALC_WINDOW_DAYS = 365;

function isoAddDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d + delta);
  return toISODateLocal(dt);
}

/**
 * Berechnet die Punkte für einen Tag komplett neu – auf Basis des AKTUELLEN
 * Stands der Planer-Einträge. Wird sowohl vom täglichen Hintergrund-Prozess
 * als auch nach CRUD-Operationen auf `meal_plan_entries` aufgerufen.
 *
 * Ablauf:
 * - Tagessummen des gesamten Fensters neu laden (Streaks hängen an Vortagen)
 * - Punkte-Serie neu berechnen; `days_late` kommt aus den Einträgen selbst,
 *   also vom ursprünglichen Eintragszeitpunkt – wiederholtes Bearbeiten
 *   umgeht den Abschlag nicht
 * - Protokoll aktualisieren, Tage ohne Punkte entfernen, Gesamtpunkte und
 *   Streak (rückwirkend) neu setzen – die Nettodifferenz wirkt damit direkt
 */
export async function recalculatePointsForDate(
  userId: string,
  date: Date | string,
): Promise<{ totalPoints: number; dayPoints: number }> {
  const iso = typeof date === "string" ? date : toISODateLocal(date);
  const today = toISODateLocal(new Date());
  const to = iso > today ? iso : today;
  // Punkte gelten nur innerhalb der laufenden Season.
  const season = await fetchActiveSeason();
  const from = season?.start_date ?? isoAddDays(to, -(RECALC_WINDOW_DAYS - 1));

  const [totals, profile, history, log] = await Promise.all([
    fetchDailyTotals(from, to),
    fetchUserProfile(),
    fetchTargetHistory(),
    fetchPointsLog(from, to),
  ]);
  // Ziel-Werte historisiert: jeder Tag wird mit den damals gültigen Zielen bewertet.
  const targets = buildTargetsResolver(history, computeTargets(profile));
  // Tracking historisiert: bereits protokollierte Tage behalten ihre damals
  // aktiven Kategorien, spätere Toggle-Änderungen wirken erst ab heute.
  const tracking = buildTrackingResolver(log, trackingFromProfile(profile));

  const dates: string[] = [];
  for (let cur = from; cur <= to; cur = isoAddDays(cur, 1)) dates.push(cur);

  const series = computePointsSeries(dates, totals, targets, tracking);
  // Nur abgeschlossene Tage (vor heute) zählen für die Gesamtpunkte.
  const completedSeries = series.filter((d) => d.date < today);
  const { totalPoints } = await syncPoints(userId, completedSeries, season?.id ?? null);
  return {
    totalPoints,
    dayPoints: series.find((d) => d.date === iso)?.points ?? 0,
  };
}
