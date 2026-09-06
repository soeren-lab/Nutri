import { queryOptions } from "@tanstack/react-query";
import { addDays, entryMacros, fetchMealPlan, toISODate } from "@/lib/meal-plan";
import type { NutritionTargets } from "@/lib/nutritionTargets";
import { asTargetsResolver, type TargetsForDate } from "@/lib/targetHistory";

/** Zielkorridor für Kalorien (80–110 % des Ziels). */
export const TARGET_MIN = 0.8;
export const TARGET_MAX = 1.1;

export type ProgressDay = {
  date: string;
  calories: number;
  protein_g: number;
  /** Mindestens ein Eintrag an diesem Tag geloggt. */
  hasEntry: boolean;
  /** Kalorien im Zielkorridor. */
  inTarget: boolean;
  /** Protein-Ziel erreicht (>= 95 % des Ziels). */
  proteinHit: boolean;
  /** Ballaststoff-Ziel erreicht (>= 95 % des Ziels). */
  fiberHit: boolean;
  /** Kohlenhydrat-Ziel erreicht (>= 95 % des Ziels). */
  carbsHit: boolean;
  /** Fett-Ziel erreicht (>= 95 % des Ziels). */
  fatHit: boolean;
  /** Zucker unter bzw. auf der Obergrenze geblieben. */
  sugarOk: boolean;
};

export type DayTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  /**
   * Höchster Nachtrags-Abstand (in Tagen) unter den Einträgen dieses Tages.
   * Der späteste Nachtrag bestimmt den Punkte-Abschlag für den ganzen Tag.
   */
  daysLate?: number;
};

export function todayDate(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Tagessummen (kcal / Protein) für einen Datumsbereich. */
export async function fetchDailyTotals(
  from: string,
  to: string,
): Promise<Record<string, DayTotals>> {
  const entries = await fetchMealPlan(from, to);
  const out: Record<string, DayTotals> = {};
  for (const e of entries) {
    // Ausgelassene Einträge dürfen keinen (auch nur Nullen-)Totals-Eintrag
    // für den Tag erzeugen – sonst zählt ein komplett übersprungener Tag
    // fälschlich als "hat einen Eintrag" für Streak/Punkte-Multiplikator.
    if (e.skipped) continue;
    const m = entryMacros(e);
    const cur = out[e.date] ?? {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      daysLate: 0,
    };
    out[e.date] = {
      calories: cur.calories + (m?.calories ?? 0),
      protein_g: cur.protein_g + (m?.protein_g ?? 0),
      carbs_g: cur.carbs_g + (m?.carbs_g ?? 0),
      fat_g: cur.fat_g + (m?.fat_g ?? 0),
      fiber_g: cur.fiber_g + (m?.fiber_g ?? 0),
      sugar_g: cur.sugar_g + (m?.sugar_g ?? 0),
      daysLate: Math.max(cur.daysLate ?? 0, e.days_late ?? 0),
    };
  }
  return out;
}

export const dailyTotalsQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["daily-totals", from, to],
    queryFn: () => fetchDailyTotals(from, to),
    staleTime: 60_000,
  });

/** Baut eine lückenlose Tagesliste (aufsteigend) mit Ziel-Bewertung. */
export function buildProgressDays(
  totals: Record<string, DayTotals>,
  start: Date,
  end: Date,
  /** Ziel-Werte oder ein Auflöser für die je Tag gültigen Ziel-Werte. */
  targets: NutritionTargets | null | TargetsForDate,
): ProgressDay[] {
  const resolve = asTargetsResolver(targets);
  const out: ProgressDay[] = [];
  const lastIso = toISODate(end);
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let i = 0; i < 500; i++) {
    const iso = toISODate(cur);
    const t = totals[iso];
    const calories = t?.calories ?? 0;
    const protein = t?.protein_g ?? 0;
    const fiber = t?.fiber_g ?? 0;
    const carbs = t?.carbs_g ?? 0;
    const fat = t?.fat_g ?? 0;
    const sugar = t?.sugar_g ?? 0;
    const dayTargets = resolve(iso);
    const targetKcal = dayTargets?.calories ?? 0;
    const targetProtein = dayTargets?.protein_g ?? 0;
    const targetFiber = dayTargets?.fiber_g ?? 0;
    const targetCarbs = dayTargets?.carbs_g ?? 0;
    const targetFat = dayTargets?.fat_g ?? 0;
    const sugarMax = dayTargets?.sugar_max_g ?? 0;
    const ratio = targetKcal > 0 ? calories / targetKcal : 0;
    out.push({
      date: iso,
      calories: Math.round(calories),
      protein_g: Math.round(protein),
      hasEntry: t != null,
      inTarget: t != null && targetKcal > 0 && ratio >= TARGET_MIN && ratio <= TARGET_MAX,
      proteinHit: t != null && targetProtein > 0 && protein >= targetProtein * 0.95,
      fiberHit: t != null && targetFiber > 0 && fiber >= targetFiber * 0.95,
      carbsHit: t != null && targetCarbs > 0 && carbs >= targetCarbs * 0.95,
      fatHit: t != null && targetFat > 0 && fat >= targetFat * 0.95,
      sugarOk: t != null && sugarMax > 0 && sugar <= sugarMax,
    });

    if (iso >= lastIso) break;
    cur = addDays(cur, 1);
  }
  return out;
}

/** Längste Serie aufeinanderfolgender Tage, die das Kriterium erfüllen. */
export function bestStreak(days: ProgressDay[], predicate: (d: ProgressDay) => boolean): number {
  let best = 0;
  let run = 0;
  for (const d of days) {
    if (predicate(d)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

/**
 * Laufende Serie bis heute. Ein heute noch leerer Tag beendet die Serie nicht,
 * solange gestern erfüllt war.
 */
export function currentStreak(
  days: ProgressDay[],
  predicate: (d: ProgressDay) => boolean = (d) => d.hasEntry,
): number {
  if (days.length === 0) return 0;
  let i = days.length - 1;
  if (!predicate(days[i]!)) i -= 1;
  let run = 0;
  for (; i >= 0; i--) {
    if (!predicate(days[i]!)) break;
    run += 1;
  }
  return run;
}
