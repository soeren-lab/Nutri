import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  entryMacros,
  entryTitle,
  fetchMealPlan,
  toISODate,
  type MacroTotals,
} from "@/lib/meal-plan";
import { useTargetsForDate } from "@/hooks/use-targets-for-date";
import { progressFactor } from "@/lib/nutritionScore";

export type StatsDay = {
  date: string;
  label: string;
  /** Am jeweiligen Tag gültige Ziel-Werte (aus der Ziel-Historie). */
  targetCalories: number | null;
  targetProtein: number | null;
  targetCarbs: number | null;
  targetFat: number | null;
  targetFiber: number | null;
  targetSugarMax: number | null;
} & MacroTotals;

export type TopItem = { name: string; count: number };

const ZERO: MacroTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0 };

function dateRange(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = toISODate(end);
  for (let i = 0; i < 400; i++) {
    out.push(cur);
    if (toISODate(cur) >= last) break;
    cur = addDays(cur, 1);
  }
  return out;
}

/**
 * Statistik über einen freien Datumsbereich: Tageswerte (Lücken als 0),
 * Durchschnitte, Trefferquote im Zielkorridor (80–110%) und Top-Einträge.
 */
export function useNutritionStats(startDate: Date, endDate: Date) {
  const from = toISODate(startDate);
  const to = toISODate(endDate);
  const { targets, targetsFor } = useTargetsForDate();

  const query = useQuery({
    queryKey: ["meal-plan-stats", from, to],
    queryFn: () => fetchMealPlan(from, to),
  });
  const entries = query.data ?? [];

  const days = useMemo<StatsDay[]>(() => {
    const byDate = new Map<string, MacroTotals>();
    for (const e of entries) {
      const m = entryMacros(e);
      if (!m) continue;
      const cur = byDate.get(e.date) ?? { ...ZERO };
      byDate.set(e.date, {
        calories: cur.calories + m.calories,
        protein_g: cur.protein_g + m.protein_g,
        carbs_g: cur.carbs_g + m.carbs_g,
        fat_g: cur.fat_g + m.fat_g,
        fiber_g: cur.fiber_g + m.fiber_g,
        sugar_g: (cur.sugar_g ?? 0) + (m.sugar_g ?? 0),
      });
    }
    return dateRange(startDate, endDate).map((d) => {
      const iso = toISODate(d);
      const t = byDate.get(iso) ?? ZERO;
      const dayTargets = targetsFor(iso);
      return {
        date: iso,
        label: `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`,
        calories: Math.round(t.calories),
        protein_g: Math.round(t.protein_g),
        carbs_g: Math.round(t.carbs_g),
        fat_g: Math.round(t.fat_g),
        fiber_g: Math.round(t.fiber_g),
        sugar_g: Math.round(t.sugar_g ?? 0),
        targetCalories: dayTargets?.calories ?? null,
        targetProtein: dayTargets?.protein_g ?? null,
        targetCarbs: dayTargets?.carbs_g ?? null,
        targetFat: dayTargets?.fat_g ?? null,
        targetFiber: dayTargets?.fiber_g ?? null,
        targetSugarMax: dayTargets?.sugar_max_g ?? null,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, from, to, targetsFor]);

  const averages = useMemo<MacroTotals>(() => {
    if (days.length === 0) return { ...ZERO };
    const sum = days.reduce(
      (acc, d) => ({
        calories: acc.calories + d.calories,
        protein_g: acc.protein_g + d.protein_g,
        carbs_g: acc.carbs_g + d.carbs_g,
        fat_g: acc.fat_g + d.fat_g,
        fiber_g: acc.fiber_g + d.fiber_g,
        sugar_g: (acc.sugar_g ?? 0) + (d.sugar_g ?? 0),
      }),
      { ...ZERO },
    );
    return {
      calories: Math.round(sum.calories / days.length),
      protein_g: Math.round(sum.protein_g / days.length),
      carbs_g: Math.round(sum.carbs_g / days.length),
      fat_g: Math.round(sum.fat_g / days.length),
      fiber_g: Math.round(sum.fiber_g / days.length),
      sugar_g: Math.round((sum.sugar_g ?? 0) / days.length),
    };
  }, [days]);

  /** Tage im Zielkorridor 80–110% der Ziel-Kalorien. */
  const hitRate = useMemo(() => {
    // Je Tag die damals gültigen Ziel-Werte verwenden.
    const rated = days.filter((d) => (targetsFor(d.date)?.calories ?? 0) > 0);
    if (rated.length === 0) return null;
    const hits = rated.filter((d) => {
      const r = d.calories / (targetsFor(d.date)?.calories ?? 0);
      return r >= 0.8 && r <= 1.1;
    }).length;
    return { hits, total: days.length };
  }, [days, targetsFor]);

  const topItems = useMemo<TopItem[]>(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const name = entryTitle(e);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5);
  }, [entries]);

  /** Vergleichsziele = Durchschnitt der je Tag gültigen Ziel-Werte. */
  const avgTargets = useMemo(() => {
    const avg = (pick: (d: StatsDay) => number | null) => {
      const vals = days.map(pick).filter((v): v is number => !!v && v > 0);
      if (vals.length === 0) return null;
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    };
    return {
      calories: avg((d) => d.targetCalories),
      protein_g: avg((d) => d.targetProtein),
      carbs_g: avg((d) => d.targetCarbs),
      fat_g: avg((d) => d.targetFat),
      fiber_g: avg((d) => d.targetFiber),
      sugar_max_g: avg((d) => d.targetSugarMax),
    };
  }, [days]);

  const avgTargetCalories = avgTargets.calories;


  const avgProgress = useMemo(
    () => (avgTargetCalories ? progressFactor(averages.calories, avgTargetCalories) : null),
    [averages, avgTargetCalories],
  );

  return {
    days,
    averages,
    hitRate,
    topItems,
    targets,
    avgTargets,
    avgProgress,
    isLoading: query.isLoading,
  };
}
