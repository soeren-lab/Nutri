import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useNutritionTargets } from "@/hooks/use-nutrition-targets";
import {
  buildTargetsResolver,
  seedTargetHistory,
  targetHistoryQuery,
  type TargetsForDate,
} from "@/lib/targetHistory";

/**
 * Liefert einen Auflöser für tagesbezogene Ziel-Werte: für jedes Datum die
 * damals gültigen Ziele aus der Historie (Fallback: aktuelle Profil-Ziele).
 */
export function useTargetsForDate(): {
  targetsFor: TargetsForDate;
  /** Heute gültige Ziel-Werte. */
  targets: ReturnType<typeof useNutritionTargets>["targets"];
  profile: ReturnType<typeof useNutritionTargets>["profile"];
  isLoading: boolean;
} {
  const { profile, targets, isLoading } = useNutritionTargets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const historyQ = useQuery({ ...targetHistoryQuery(), enabled: !!user });
  const seeded = useRef(false);

  // Einmalige Nachbefüllung der Historie für bestehende Nutzer.
  useEffect(() => {
    if (seeded.current || !user || !targets || !historyQ.data) return;
    seeded.current = true;
    void seedTargetHistory(user.id, historyQ.data, targets).then((changed) => {
      if (changed) void qc.invalidateQueries({ queryKey: ["target-history"] });
    });
  }, [user, targets, historyQ.data, qc]);

  const targetsFor = useMemo(
    () => buildTargetsResolver(historyQ.data ?? [], targets),
    [historyQ.data, targets],
  );

  return { targetsFor, targets, profile, isLoading: isLoading || historyQ.isLoading };
}
