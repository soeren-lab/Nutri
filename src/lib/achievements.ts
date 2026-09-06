import { queryOptions } from "@tanstack/react-query";
import {
  Award,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChefHat,
  Crown,
  Flame,
  Footprints,
  Globe,
  Heart,
  Layers,
  Repeat,
  Scale,
  Sparkles,
  Sunrise,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { bestStreak, type ProgressDay } from "@/lib/progress";
import type { BodyMeasurement } from "@/lib/bodyMeasurements";
import type { Goal } from "@/lib/nutritionTargets";
import { rankForPoints, RANK_THRESHOLDS } from "@/lib/ranks";
import {
  EMPTY_ACHIEVEMENT_STATS,
  type AchievementStats,
} from "@/lib/achievement-stats";
import {
  DEFAULT_TRACKING,
  type TrackableMacroKey,
  type TrackingSettings,
} from "@/lib/tracking";

export type Achievement = Tables<"achievements">;

export type AchievementContext = {
  days: ProgressDay[];
  measurements: BodyMeasurement[];
  goal: Goal;
  /** Individuelle Tracking-Einstellungen (Default: alle aktiv). */
  tracking?: TrackingSettings;
  /** Zusatzwerte (Rezepte, Freunde, Planung, Punkte). */
  stats?: AchievementStats;
};

export type AchievementDefinition = {
  key: string;
  icon: LucideIcon;
  /** Titel, ggf. abhängig vom Ziel (abnehmen/aufbauen). */
  title: (goal: Goal) => string;
  description: (goal: Goal) => string;
  /** Zielwert für die Fortschrittsanzeige. */
  goalValue: number;
  unit: string | null;
  /** Aktueller Fortschrittswert. */
  value: (ctx: AchievementContext) => number;
  /** Nur relevant, wenn diese Nährwert-Kategorie getrackt wird. */
  requiresTracking?: TrackableMacroKey;
  /** Nur für diese Ziele sichtbar (Default: alle). */
  goals?: Goal[];
};

function stats(ctx: AchievementContext): AchievementStats {
  return ctx.stats ?? EMPTY_ACHIEVEMENT_STATS;
}

function weightProgress(ctx: AchievementContext): number {
  const withWeight = ctx.measurements.filter((m) => m.weight_kg != null);
  if (withWeight.length < 2) return 0;
  const first = Number(withWeight[0]!.weight_kg);
  const last = Number(withWeight[withWeight.length - 1]!.weight_kg);
  const delta = ctx.goal === "gain" ? last - first : first - last;
  return Math.max(0, delta);
}

function weightMilestone(kg: number, goal: "lose" | "gain"): AchievementDefinition {
  return {
    key: goal === "gain" ? `weight_gain_${kg}kg` : `weight_${kg}kg`,
    icon: goal === "gain" ? TrendingUp : kg >= 10 ? Award : TrendingDown,
    title: () => (goal === "gain" ? `+${kg} kg aufgebaut` : `−${kg} kg geschafft`),
    description: () =>
      goal === "gain"
        ? `${kg} kg mehr als beim ersten Eintrag`
        : `${kg} kg weniger als beim ersten Eintrag`,
    goalValue: kg,
    unit: "kg",
    goals: [goal],
    value: weightProgress,
  };
}

/** Längste Spanne (Tage) mit stabilem Gewicht innerhalb von ±1 kg. */
function stableWeightDays(ctx: AchievementContext): number {
  const rows = ctx.measurements
    .filter((m) => m.weight_kg != null)
    .map((m) => ({ date: m.date, kg: Number(m.weight_kg) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  for (let i = 0; i < rows.length; i++) {
    let min = rows[i]!.kg;
    let max = rows[i]!.kg;
    for (let j = i + 1; j < rows.length; j++) {
      min = Math.min(min, rows[j]!.kg);
      max = Math.max(max, rows[j]!.kg);
      if (max - min > 2) break; // ±1 kg um die Mitte
      const days =
        (new Date(rows[j]!.date).getTime() - new Date(rows[i]!.date).getTime()) /
        86_400_000;
      best = Math.max(best, Math.round(days));
    }
  }
  return best;
}

/** Alle aktivierten Kategorien an einem Tag gleichzeitig im Ziel. */
function allTrackedInTargetDays(ctx: AchievementContext): number {
  const t = ctx.tracking ?? DEFAULT_TRACKING;
  return ctx.days.filter(
    (d) =>
      d.inTarget &&
      (!t.protein_g || d.proteinHit) &&
      (!t.carbs_g || d.carbsHit) &&
      (!t.fat_g || d.fatHit) &&
      (!t.fiber_g || d.fiberHit),
  ).length
    ? 1
    : 0;
}

/** Längste Serie geloggter Tage, die auf eine Pause von ≥ 7 Tagen folgt. */
function comebackStreak(ctx: AchievementContext): number {
  let gap = 0;
  let run = 0;
  let best = 0;
  let afterGap = false;
  for (const d of ctx.days) {
    if (d.hasEntry) {
      if (gap >= 7) afterGap = true;
      gap = 0;
      run += 1;
      if (afterGap) best = Math.max(best, run);
    } else {
      gap += 1;
      run = 0;
      if (gap >= 7) afterGap = false;
    }
  }
  return best;
}

const ELITE_1_POINTS =
  RANK_THRESHOLDS.find((t) => t.key === "elite_1")?.points ?? 11_000;

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    key: "first_meal",
    icon: Footprints,
    title: () => "Erste Schritte",
    description: () => "Erste Mahlzeit geloggt",
    goalValue: 1,
    unit: null,
    value: (ctx) => (ctx.days.some((d) => d.hasEntry) ? 1 : 0),
  },
  {
    key: "streak_7",
    icon: Flame,
    title: () => "Eine Woche dabei",
    description: () => "7 Tage in Folge mindestens ein Eintrag",
    goalValue: 7,
    unit: "Tage",
    value: (ctx) => bestStreak(ctx.days, (d) => d.hasEntry),
  },
  {
    key: "in_target_day",
    icon: Target,
    title: () => "Im Ziel",
    description: () => "Ein Tag im Kalorien-Korridor (80–110 %)",
    goalValue: 1,
    unit: null,
    value: (ctx) => (ctx.days.some((d) => d.inTarget) ? 1 : 0),
  },
  {
    key: "in_target_7",
    icon: CalendarCheck,
    title: () => "Konstant",
    description: () => "7 Tage in Folge im Kalorien-Korridor",
    goalValue: 7,
    unit: "Tage",
    value: (ctx) => bestStreak(ctx.days, (d) => d.inTarget),
  },
  {
    key: "protein_7",
    icon: Award,
    title: () => "Protein-Profi",
    description: () => "7 Tage in Folge das Protein-Ziel erreicht",
    goalValue: 7,
    unit: "Tage",
    requiresTracking: "protein_g",
    value: (ctx) => bestStreak(ctx.days, (d) => d.proteinHit),
  },
  {
    key: "fiber_7",
    icon: Award,
    title: () => "Ballaststoff-Fan",
    description: () => "7 Tage in Folge das Ballaststoff-Ziel erreicht",
    goalValue: 7,
    unit: "Tage",
    requiresTracking: "fiber_g",
    value: (ctx) => bestStreak(ctx.days, (d) => d.fiberHit),
  },
  {
    key: "sugar_7",
    icon: Sparkles,
    title: () => "Zuckerbewusst",
    description: () => "7 Tage in Folge unter der Zucker-Obergrenze",
    goalValue: 7,
    unit: "Tage",
    value: (ctx) => bestStreak(ctx.days, (d) => d.sugarOk),
  },
  {
    key: "all_macros_day",
    icon: Layers,
    title: () => "Alles im Blick",
    description: () => "Alle aktivierten Kategorien an einem Tag im Ziel",
    goalValue: 1,
    unit: null,
    value: allTrackedInTargetDays,
  },
  {
    key: "early_breakfast_7",
    icon: Sunrise,
    title: () => "Frühaufsteher",
    description: () => "7× das Frühstück vor 9 Uhr geloggt",
    goalValue: 7,
    unit: "Tage",
    value: (ctx) => stats(ctx).earlyBreakfastDays,
  },
  {
    key: "streak_30",
    icon: CalendarDays,
    title: () => "Ein Monat",
    description: () => "30 Tage in Folge mindestens ein Eintrag",
    goalValue: 30,
    unit: "Tage",
    value: (ctx) => bestStreak(ctx.days, (d) => d.hasEntry),
  },
  {
    key: "streak_90",
    icon: CalendarDays,
    title: () => "Drei Monate stark",
    description: () => "90 Tage in Folge geloggt",
    goalValue: 90,
    unit: "Tage",
    value: (ctx) => bestStreak(ctx.days, (d) => d.hasEntry),
  },
  {
    key: "streak_180",
    icon: Trophy,
    title: () => "Halbes Jahr",
    description: () => "180 Tage in Folge geloggt",
    goalValue: 180,
    unit: "Tage",
    value: (ctx) => bestStreak(ctx.days, (d) => d.hasEntry),
  },
  {
    key: "comeback_7",
    icon: Repeat,
    title: () => "Comeback",
    description: () => "Nach ≥ 7 Tagen Pause wieder 7 Tage in Folge geloggt",
    goalValue: 7,
    unit: "Tage",
    value: comebackStreak,
  },
  {
    key: "plan_week_ahead",
    icon: CalendarCheck,
    title: () => "Vorausdenker",
    description: () => "Eine ganze Woche im Voraus komplett durchgeplant",
    goalValue: 1,
    unit: null,
    value: (ctx) => (stats(ctx).plannedWeeksAhead >= 1 ? 1 : 0),
  },
  {
    key: "plan_4_weeks",
    icon: Layers,
    title: () => "Meal-Prep-Profi",
    description: () => "4 Wochen in Folge im Voraus geplant",
    goalValue: 4,
    unit: "Wochen",
    value: (ctx) => stats(ctx).plannedWeeksAhead,
  },
  {
    key: "recipe_1",
    icon: UtensilsCrossed,
    title: () => "Erster Wurf",
    description: () => "Erstes eigenes Rezept angelegt",
    goalValue: 1,
    unit: null,
    value: (ctx) => stats(ctx).ownRecipes,
  },
  {
    key: "recipe_20",
    icon: BookOpen,
    title: () => "Vielfalt pur",
    description: () => "20 eigene Rezepte angelegt",
    goalValue: 20,
    unit: "Rezepte",
    value: (ctx) => stats(ctx).ownRecipes,
  },
  {
    key: "recipe_50",
    icon: ChefHat,
    title: () => "Sternekoch",
    description: () => "50 eigene Rezepte angelegt",
    goalValue: 50,
    unit: "Rezepte",
    value: (ctx) => stats(ctx).ownRecipes,
  },
  {
    key: "friend_1",
    icon: Users,
    title: () => "Erster Freund",
    description: () => "Erste Freundschaft geschlossen",
    goalValue: 1,
    unit: null,
    value: (ctx) => stats(ctx).friends,
  },
  {
    key: "friend_10",
    icon: Heart,
    title: () => "Beliebt",
    description: () => "10 Freunde erreicht",
    goalValue: 10,
    unit: "Freunde",
    value: (ctx) => stats(ctx).friends,
  },
  {
    key: "publish_1",
    icon: Globe,
    title: () => "Community-Beitrag",
    description: () => "Erstes Rezept veröffentlicht",
    goalValue: 1,
    unit: null,
    value: (ctx) => stats(ctx).publishedRecipes,
  },
  {
    key: "imported_10",
    icon: Sparkles,
    title: () => "Inspiration",
    description: () => "Ein veröffentlichtes Rezept wurde 10× importiert",
    goalValue: 10,
    unit: "Importe",
    value: (ctx) => stats(ctx).maxImports,
  },
  {
    key: "rank_up_1",
    icon: TrendingUp,
    title: () => "Aufsteiger",
    description: () => "Erster Rang-Aufstieg geschafft",
    goalValue: 1,
    unit: null,
    value: (ctx) =>
      rankForPoints(stats(ctx).totalPoints).current.key === RANK_THRESHOLDS[0]!.key
        ? 0
        : 1,
  },
  {
    key: "rank_elite",
    icon: Crown,
    title: () => "Elite erreicht",
    description: () => "Rang „Elite 1“ erreicht",
    goalValue: ELITE_1_POINTS,
    unit: "Punkte",
    value: (ctx) => stats(ctx).totalPoints,
  },
  {
    key: "first_weight",
    icon: Scale,
    title: () => "Erster Fortschritt",
    description: () => "Ersten Gewichtseintrag gespeichert",
    goalValue: 1,
    unit: null,
    value: (ctx) => (ctx.measurements.some((m) => m.weight_kg != null) ? 1 : 0),
  },
  weightMilestone(2, "lose"),
  weightMilestone(5, "lose"),
  weightMilestone(10, "lose"),
  weightMilestone(2, "gain"),
  weightMilestone(5, "gain"),
  weightMilestone(10, "gain"),
  {
    key: "weight_stable_30",
    icon: Scale,
    title: () => "Stabil geblieben",
    description: () => "Gewicht 30 Tage lang innerhalb von ±1 kg gehalten",
    goalValue: 30,
    unit: "Tage",
    goals: ["maintain"],
    value: stableWeightDays,
  },
];

export type AchievementState = {
  definition: AchievementDefinition;
  title: string;
  description: string;
  value: number;
  unlocked: boolean;
  unlockedAt: string | null;
  /** Fortschritts-Label, z. B. "4/7 Tage". */
  progressLabel: string | null;
  /** Kategorie-Tracking deaktiviert: nicht erreichbar, aber auch nicht "verpasst". */
  unavailable: boolean;
};

function formatValue(value: number, unit: AchievementDefinition["unit"]): string {
  return unit === "kg" ? value.toFixed(1) : String(Math.round(value));
}

export function evaluateAchievements(
  ctx: AchievementContext,
  rows: Achievement[],
): AchievementState[] {
  const byKey = new Map(rows.map((r) => [r.achievement_key, r]));
  return ACHIEVEMENT_DEFINITIONS.filter((definition) => {
    // Ziel-abhängige Abzeichen: nur passende zeigen – bereits
    // freigeschaltete bleiben trotz Zielwechsel sichtbar.
    if (!definition.goals) return true;
    return definition.goals.includes(ctx.goal) || byKey.has(definition.key);
  }).map((definition) => {
    const tracking = ctx.tracking ?? DEFAULT_TRACKING;
    const row = byKey.get(definition.key) ?? null;
    const unavailable =
      definition.requiresTracking != null &&
      !tracking[definition.requiresTracking] &&
      row == null;
    const value = unavailable ? 0 : definition.value(ctx);
    const unlocked = row != null || (!unavailable && value >= definition.goalValue);
    return {
      unavailable,
      definition,
      title: definition.title(ctx.goal),
      description: definition.description(ctx.goal),
      value,
      unlocked,
      unlockedAt: row?.unlocked_at ?? null,
      progressLabel:
        unlocked || unavailable || definition.goalValue <= 1
          ? null
          : `${formatValue(value, definition.unit)}/${formatValue(definition.goalValue, definition.unit)}${
              definition.unit ? ` ${definition.unit}` : ""
            }`,
    };
  });
}

export async function fetchAchievements(): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from("achievements")
    .select("*")
    .order("unlocked_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export const achievementsQuery = () =>
  queryOptions({
    queryKey: ["achievements"],
    queryFn: fetchAchievements,
    staleTime: 60_000,
  });

/** Legt neu erfüllte Abzeichen an und gibt die neu freigeschalteten Keys zurück. */
export async function unlockAchievements(
  userId: string,
  items: { key: string; progress_value: number }[],
): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase.from("achievements").upsert(
    items.map((i) => ({
      user_id: userId,
      achievement_key: i.key,
      progress_value: i.progress_value,
    })),
    { onConflict: "user_id,achievement_key", ignoreDuplicates: true },
  );
  if (error) throw error;
}
