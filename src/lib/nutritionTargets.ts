import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

export type UserProfile = Tables<"user_profile">;

export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type GoalRate = "slow" | "moderate" | "fast";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sitzend (kaum Bewegung)",
  light: "Leicht aktiv (1–2× Sport/Woche)",
  moderate: "Moderat aktiv (3–4× Sport/Woche)",
  active: "Aktiv (5–6× Sport/Woche)",
  very_active: "Sehr aktiv (täglich/körperliche Arbeit)",
};

export const GOAL_LABELS: Record<Goal, string> = {
  lose: "Abnehmen",
  maintain: "Halten",
  gain: "Aufbauen",
};

export const GOAL_RATE_LABELS: Record<GoalRate, string> = {
  slow: "Langsam (250 kcal)",
  moderate: "Moderat (500 kcal)",
  fast: "Schnell (750 kcal)",
};

export const RATE_DELTAS: Record<GoalRate, number> = {
  slow: 250,
  moderate: 500,
  fast: 750,
};

export const SEX_LABELS: Record<Sex, string> = {
  male: "Männlich",
  female: "Weiblich",
};

/**
 * Richtwert für Ballaststoffe: 14 g pro 1000 kcal (allgemeine Faustregel).
 */
export const FIBER_G_PER_1000_KCAL = 14;

export function recommendedFiber(calories: number): number {
  return Math.round((calories / 1000) * FIBER_G_PER_1000_KCAL);
}

/**
 * Richtwert für die Zucker-Obergrenze (freier Zucker), ca. 50 g/Tag.
 * Rein informativ – Zucker ist nicht Teil des Punktesystems.
 */
export const SUGAR_MAX_DEFAULT_G = 50;

export type NutritionTargets = {
  bmr: number;
  tdee: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  /** Obergrenze für Zucker (informativ, kein Ziel-Korridor). */
  sugar_max_g: number;
  /** true, wenn die Werte aus manuellen Eingaben stammen. */
  manual: boolean;
};

/** BMR nach Mifflin-St-Jeor. */
export function calcBmr(input: {
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: Sex;
}): number {
  const base = 10 * input.weight_kg + 6.25 * input.height_cm - 5 * input.age;
  return input.sex === "male" ? base + 5 : base - 161;
}

export function calcTdee(bmr: number, activity: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[activity];
}

export function calcGoalCalories(tdee: number, goal: Goal, rate: GoalRate): number {
  if (goal === "maintain") return tdee;
  const delta = RATE_DELTAS[rate];
  return goal === "lose" ? tdee - delta : tdee + delta;
}

/**
 * Berechnet die Ziel-Werte on-the-fly aus dem Profil.
 * Manuelle Overrides haben Vorrang (nur wenn Kalorien gesetzt sind).
 */
export function computeTargets(
  profile: Partial<UserProfile> | null | undefined,
): NutritionTargets | null {
  if (!profile) return null;

  const manualCalories =
    profile.target_calories != null ? Number(profile.target_calories) : null;

  const weight = profile.weight_kg != null ? Number(profile.weight_kg) : null;
  const height = profile.height_cm != null ? Number(profile.height_cm) : null;
  const age = profile.age != null ? Number(profile.age) : null;
  const sex = (profile.sex as Sex | null) ?? null;

  let bmr = 0;
  let tdee = 0;
  let calories = manualCalories ?? 0;

  if (weight && height && age && sex) {
    bmr = calcBmr({ weight_kg: weight, height_cm: height, age, sex });
    tdee = calcTdee(bmr, (profile.activity_level as ActivityLevel) ?? "moderate");
    if (manualCalories == null) {
      calories = calcGoalCalories(
        tdee,
        (profile.goal as Goal) ?? "maintain",
        (profile.goal_rate as GoalRate) ?? "moderate",
      );
    }
  }

  if (!calories) return null;

  // Makro-Standard: Protein 2 g/kg, Fett 25 % der Kalorien, Rest KH.
  const protein =
    profile.target_protein_g != null
      ? Number(profile.target_protein_g)
      : weight
        ? weight * 2
        : (calories * 0.3) / 4;
  const fat =
    profile.target_fat_g != null
      ? Number(profile.target_fat_g)
      : (calories * 0.25) / 9;
  const carbs =
    profile.target_carbs_g != null
      ? Number(profile.target_carbs_g)
      : Math.max(0, (calories - protein * 4 - fat * 9) / 4);

  const fiber =
    profile.target_fiber_g != null
      ? Number(profile.target_fiber_g)
      : recommendedFiber(calories);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories: Math.round(calories),
    protein_g: Math.round(protein),
    carbs_g: Math.round(carbs),
    fat_g: Math.round(fat),
    fiber_g: Math.round(fiber),
    sugar_max_g: Math.round(
      profile.target_sugar_max_g != null
        ? Number(profile.target_sugar_max_g)
        : SUGAR_MAX_DEFAULT_G,
    ),
    manual: manualCalories != null,
  };
}

/**
 * Nähe an einem Zielwert als Faktor 0–1 (1 = genau am Ziel).
 * Abweichungen nach oben und unten werden gleich behandelt.
 */
export function targetCloseness(value: number, target: number): number {
  if (!target) return 0;
  const deviation = Math.abs(value - target) / target;
  return Math.max(0, Math.min(1, 1 - deviation / 0.35));
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profile")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export const userProfileQuery = () =>
  queryOptions({ queryKey: ["user-profile"], queryFn: fetchUserProfile });

export async function saveUserProfile(
  userId: string,
  values: Partial<Omit<UserProfile, "user_id" | "created_at" | "updated_at">>,
) {
  const { error } = await supabase
    .from("user_profile")
    .upsert({ user_id: userId, ...values }, { onConflict: "user_id" });
  if (error) throw error;
}
