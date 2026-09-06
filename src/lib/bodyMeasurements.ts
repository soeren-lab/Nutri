import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type BodyMeasurement = Tables<"body_measurements">;

export type BodyMeasurementInput = {
  date: string;
  weight_kg: number;
  body_fat_percent: number | null;
  note: string | null;
};

export async function fetchBodyMeasurements(): Promise<BodyMeasurement[]> {
  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export const bodyMeasurementsQuery = () =>
  queryOptions({
    queryKey: ["body-measurements"],
    queryFn: fetchBodyMeasurements,
    staleTime: 60_000,
  });

/** Speichert (bzw. überschreibt) den Eintrag eines Tages. */
export async function saveBodyMeasurement(
  userId: string,
  input: BodyMeasurementInput,
): Promise<void> {
  const { error } = await supabase.from("body_measurements").upsert(
    {
      user_id: userId,
      date: input.date,
      weight_kg: input.weight_kg,
      body_fat_percent: input.body_fat_percent,
      note: input.note,
    },
    { onConflict: "user_id,date" },
  );
  if (error) throw error;
}

export async function deleteBodyMeasurement(id: string): Promise<void> {
  const { error } = await supabase.from("body_measurements").delete().eq("id", id);
  if (error) throw error;
}

export function measurementsInRange(
  measurements: BodyMeasurement[],
  from: string,
  to: string,
): BodyMeasurement[] {
  return measurements.filter((m) => m.date >= from && m.date <= to);
}

export function latestWeight(measurements: BodyMeasurement[]): BodyMeasurement | null {
  for (let i = measurements.length - 1; i >= 0; i--) {
    if (measurements[i]!.weight_kg != null) return measurements[i]!;
  }
  return null;
}

export function latestBodyFat(measurements: BodyMeasurement[]): BodyMeasurement | null {
  for (let i = measurements.length - 1; i >= 0; i--) {
    if (measurements[i]!.body_fat_percent != null) return measurements[i]!;
  }
  return null;
}

/** Gewichtsänderung innerhalb der letzten n Tage (kg), null wenn zu wenig Daten. */
export function weightTrend(
  measurements: BodyMeasurement[],
  days = 28,
): { delta: number; days: number } | null {
  const withWeight = measurements.filter((m) => m.weight_kg != null);
  if (withWeight.length < 2) return null;
  const last = withWeight[withWeight.length - 1]!;
  const limit = new Date(last.date);
  limit.setDate(limit.getDate() - days);
  const limitIso = limit.toISOString().slice(0, 10);
  const candidates = withWeight.filter((m) => m.date >= limitIso);
  const first = (candidates.length >= 2 ? candidates[0] : withWeight[0])!;
  if (first.id === last.id) return null;
  return {
    delta: Number(last.weight_kg) - Number(first.weight_kg),
    days: Math.max(
      1,
      Math.round(
        (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000,
      ),
    ),
  };
}

/** Differenz zum allerersten Gewichtseintrag (kg). */
export function weightDeltaSinceStart(measurements: BodyMeasurement[]): number | null {
  const withWeight = measurements.filter((m) => m.weight_kg != null);
  if (withWeight.length < 2) return null;
  return (
    Number(withWeight[withWeight.length - 1]!.weight_kg) -
    Number(withWeight[0]!.weight_kg)
  );
}
