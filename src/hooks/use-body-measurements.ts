import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  bodyMeasurementsQuery,
  deleteBodyMeasurement,
  latestBodyFat,
  latestWeight,
  measurementsInRange,
  saveBodyMeasurement,
  weightTrend,
  type BodyMeasurementInput,
} from "@/lib/bodyMeasurements";
import { toISODate } from "@/lib/meal-plan";

export type MeasurementRange = { start: Date; end: Date };

/** Körperwerte (alle + Bereich) inkl. Speichern/Löschen. */
export function useBodyMeasurements(range?: MeasurementRange) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery(bodyMeasurementsQuery());
  const all = query.data ?? [];

  const inRange = useMemo(() => {
    if (!range) return all;
    return measurementsInRange(all, toISODate(range.start), toISODate(range.end));
  }, [all, range?.start, range?.end]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["body-measurements"] });
    void qc.invalidateQueries({ queryKey: ["achievements"] });
  };

  const save = useMutation({
    mutationFn: async (input: BodyMeasurementInput) => {
      if (!user) throw new Error("Nicht angemeldet");
      await saveBodyMeasurement(user.id, input);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Körperwerte gespeichert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBodyMeasurement(id),
    onSuccess: () => {
      invalidate();
      toast.success("Eintrag gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    all,
    measurements: inRange,
    isLoading: query.isLoading,
    latestWeight: latestWeight(all),
    latestBodyFat: latestBodyFat(all),
    trend: weightTrend(all),
    save,
    remove,
  };
}
