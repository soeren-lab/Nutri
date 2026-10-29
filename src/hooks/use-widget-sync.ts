import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTargetsForDate } from "@/hooks/use-targets-for-date";
import { entryMacros, mealPlanQuery, startOfWeek, toISODate } from "@/lib/meal-plan";
import { isNativeApp } from "@/lib/platform";
import { WATER_GOAL_EVENT, getWaterGoal, totalWaterMl, waterQuery } from "@/lib/water";
import { updateWidget } from "@/lib/widget-bridge";

/**
 * Hält das Startbildschirm-Widget aktuell: sobald sich Kalorien, Protein oder Wasser von heute
 * ändern (Planer, Wasser-Zähler, Sync nach dem Offline-Gehen), gehen die neuen Werte ans Widget.
 * Läuft nur in der Android-App.
 */
export function useWidgetSync() {
  const { user } = useAuth();
  const native = isNativeApp();
  const today = new Date();
  const todayIso = toISODate(today);

  const { data: entries } = useQuery({
    ...mealPlanQuery(startOfWeek(today)),
    enabled: native && !!user,
  });
  const { data: water } = useQuery({ ...waterQuery(todayIso), enabled: native && !!user });
  const { targetsFor } = useTargetsForDate();
  const targets = targetsFor(todayIso);

  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  for (const entry of entries ?? []) {
    if (entry.date !== todayIso) continue;
    const macros = entryMacros(entry);
    if (!macros) continue;
    kcal += macros.calories;
    protein += macros.protein_g;
    carbs += macros.carbs_g;
    fat += macros.fat_g;
  }
  const waterMl = totalWaterMl(water ?? []);
  const [waterGoal, setWaterGoalState] = useState(getWaterGoal);
  useEffect(() => {
    const onChange = () => setWaterGoalState(getWaterGoal());
    window.addEventListener(WATER_GOAL_EVENT, onChange);
    return () => window.removeEventListener(WATER_GOAL_EVENT, onChange);
  }, []);
  const kcalTarget = Math.round(targets?.calories ?? 0);
  const proteinTarget = Math.round(targets?.protein_g ?? 0);
  const roundedKcal = Math.round(kcal);
  const roundedProtein = Math.round(protein);
  const roundedCarbs = Math.round(carbs);
  const roundedFat = Math.round(fat);
  const carbsTarget = Math.round(targets?.carbs_g ?? 0);
  const fatTarget = Math.round(targets?.fat_g ?? 0);
  const loaded = entries !== undefined;

  useEffect(() => {
    if (!native || !user || !loaded) return;
    void updateWidget({
      date: todayIso,
      kcal: roundedKcal,
      kcalTarget,
      protein: roundedProtein,
      proteinTarget,
      water: waterMl,
      waterTarget: waterGoal,
      carbs: roundedCarbs,
      carbsTarget,
      fat: roundedFat,
      fatTarget,
    });
  }, [
    native,
    user,
    loaded,
    todayIso,
    roundedKcal,
    kcalTarget,
    roundedProtein,
    proteinTarget,
    waterMl,
    waterGoal,
    roundedCarbs,
    carbsTarget,
    roundedFat,
    fatTarget,
  ]);
}
