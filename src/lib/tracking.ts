import type { Tables } from "@/integrations/supabase/types";

/** Nährwerte, die einzeln an-/abgeschaltet werden können. */
export type TrackableMacroKey = "protein_g" | "carbs_g" | "fat_g" | "fiber_g";

/** Kalorien sind Basis der App und immer aktiv. */
export type TrackingSettings = {
  calories: true;
  protein_g: boolean;
  carbs_g: boolean;
  fat_g: boolean;
  fiber_g: boolean;
  /** Nur Sichtbarkeit – Zucker ist nie Teil des Punktesystems. */
  sugar_g: boolean;
};

export const DEFAULT_TRACKING: TrackingSettings = {
  calories: true,
  protein_g: true,
  carbs_g: true,
  fat_g: true,
  fiber_g: true,
  sugar_g: true,
};

/** Zuordnung Nährwert → Spalte in `user_profile`. */
export const TRACKING_COLUMNS: Record<
  TrackableMacroKey | "sugar_g",
  "track_protein" | "track_carbs" | "track_fat" | "track_fiber" | "track_sugar"
> = {
  protein_g: "track_protein",
  carbs_g: "track_carbs",
  fat_g: "track_fat",
  fiber_g: "track_fiber",
  sugar_g: "track_sugar",
};

export const TRACKABLE_KEYS: TrackableMacroKey[] = [
  "protein_g",
  "carbs_g",
  "fat_g",
  "fiber_g",
];

export const TRACKING_LABELS: Record<TrackableMacroKey | "sugar_g", string> = {
  protein_g: "Protein",
  carbs_g: "Kohlenhydrate",
  fat_g: "Fett",
  fiber_g: "Ballaststoffe",
  sugar_g: "Zucker",
};


type ProfileLike = Partial<Tables<"user_profile">> | null | undefined;

/** Liest die Tracking-Einstellungen aus dem Profil (Default: alles aktiv). */
export function trackingFromProfile(profile: ProfileLike): TrackingSettings {
  return {
    calories: true,
    protein_g: profile?.track_protein ?? true,
    carbs_g: profile?.track_carbs ?? true,
    fat_g: profile?.track_fat ?? true,
    fiber_g: profile?.track_fiber ?? true,
    sugar_g: profile?.track_sugar ?? true,

  };
}

/** Ist ein Nährwert aktiv getrackt? */
export function isTracked(
  tracking: TrackingSettings | null | undefined,
  key: keyof TrackingSettings,
): boolean {
  if (key === "calories") return true;
  return (tracking ?? DEFAULT_TRACKING)[key];
}
