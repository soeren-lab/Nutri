import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, MEAL_SLOTS, toISODate } from "@/lib/meal-plan";
import { todayDate } from "@/lib/progress";

/** Zusatzwerte für Abzeichen, die nicht aus den Tagesdaten kommen. */
export type AchievementStats = {
  /** Eigene Rezepte (alle, auch unveröffentlichte). */
  ownRecipes: number;
  /** Eigene veröffentlichte Rezepte. */
  publishedRecipes: number;
  /** Häufigster Import eines eigenen veröffentlichten Rezepts. */
  maxImports: number;
  /** Bestätigte Freundschaften. */
  friends: number;
  /** Wochen in Folge (ab dieser Woche) komplett im Voraus geplant. */
  plannedWeeksAhead: number;
  /** Tage, an denen das Frühstück vor 9 Uhr geloggt wurde. */
  earlyBreakfastDays: number;
  /** Gesamtpunkte (inkl. Bonus) für Rang-Abzeichen. */
  totalPoints: number;
};

export const EMPTY_ACHIEVEMENT_STATS: AchievementStats = {
  ownRecipes: 0,
  publishedRecipes: 0,
  maxImports: 0,
  friends: 0,
  plannedWeeksAhead: 0,
  earlyBreakfastDays: 0,
  totalPoints: 0,
};

/** Zählt Wochen in Folge (ab heute), in denen jeder Tag alle Slots gefüllt hat. */
function countPlannedWeeks(
  rows: { date: string; meal_slot: string }[],
  today: Date,
): number {
  const bySlotDay = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = bySlotDay.get(r.date) ?? new Set<string>();
    set.add(r.meal_slot);
    bySlotDay.set(r.date, set);
  }
  let weeks = 0;
  for (let w = 0; w < 4; w++) {
    let complete = true;
    for (let d = 0; d < 7; d++) {
      const iso = toISODate(addDays(today, w * 7 + d));
      const slots = bySlotDay.get(iso);
      if (!slots || MEAL_SLOTS.some((s) => !slots.has(s))) {
        complete = false;
        break;
      }
    }
    if (!complete) break;
    weeks += 1;
  }
  return weeks;
}

export async function fetchAchievementStats(
  userId: string,
): Promise<AchievementStats> {
  const today = todayDate();
  const planFrom = toISODate(today);
  const planTo = toISODate(addDays(today, 27));
  const breakfastFrom = toISODate(addDays(today, -364));

  const [own, published, imports, friends, plan, breakfasts, points] =
    await Promise.all([
      supabase
        .from("recipes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("recipes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_published", true),
      supabase.rpc("get_my_recipe_import_count"),
      supabase.from("friendships").select("id", { count: "exact", head: true }),
      supabase
        .from("meal_plan_entries")
        .select("date, meal_slot")
        .gte("date", planFrom)
        .lte("date", planTo),
      supabase
        .from("meal_plan_entries")
        .select("date, created_at")
        .eq("meal_slot", MEAL_SLOTS[0])
        .gte("date", breakfastFrom),
      supabase
        .from("user_points")
        .select("total_points, bonus_points")
        .maybeSingle(),
    ]);

  const earlyDays = new Set<string>();
  for (const r of breakfasts.data ?? []) {
    if (!r.created_at) continue;
    if (new Date(r.created_at).getHours() < 9) earlyDays.add(r.date);
  }

  return {
    ownRecipes: own.count ?? 0,
    publishedRecipes: published.count ?? 0,
    maxImports: Number(imports.data ?? 0),
    friends: friends.count ?? 0,
    plannedWeeksAhead: countPlannedWeeks(plan.data ?? [], today),
    earlyBreakfastDays: earlyDays.size,
    totalPoints:
      (points.data?.total_points ?? 0) + (points.data?.bonus_points ?? 0),
  };
}

export const achievementStatsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["achievement-stats", userId],
    queryFn: () => fetchAchievementStats(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
