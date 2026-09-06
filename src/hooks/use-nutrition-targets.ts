import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { computeTargets, userProfileQuery } from "@/lib/nutritionTargets";

/** Lädt das Profil und berechnet daraus die Ziel-Werte (on-the-fly). */
export function useNutritionTargets() {
  const query = useQuery({ ...userProfileQuery(), staleTime: 60_000 });
  const profile = query.data ?? null;
  const targets = useMemo(() => computeTargets(profile), [profile]);
  return { profile, targets, isLoading: query.isLoading };
}
