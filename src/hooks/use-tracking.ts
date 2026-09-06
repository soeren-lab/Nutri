import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { userProfileQuery } from "@/lib/nutritionTargets";
import { trackingFromProfile, type TrackingSettings } from "@/lib/tracking";

/**
 * Individuelle Tracking-Einstellungen (welche Nährwerte gezählt werden).
 * Kalorien sind immer aktiv.
 */
export function useTracking(): {
  tracking: TrackingSettings;
  isLoading: boolean;
} {
  const query = useQuery({ ...userProfileQuery(), staleTime: 60_000 });
  const tracking = useMemo(
    () => trackingFromProfile(query.data ?? null),
    [query.data],
  );
  return { tracking, isLoading: query.isLoading };
}
