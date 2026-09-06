import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useNutritionTargets } from "@/hooks/use-nutrition-targets";
import {
  computeTargets,
  saveUserProfile,
  type ActivityLevel,
  type Goal,
  type GoalRate,
  type Sex,
} from "@/lib/nutritionTargets";
import { recordTargetsForToday } from "@/lib/targetHistory";

export type FormState = {
  weight_kg: string;
  height_cm: string;
  age: string;
  sex: Sex;
  activity_level: ActivityLevel;
  goal: Goal;
  goal_rate: GoalRate;
  target_calories: string;
  target_protein_g: string;
  target_carbs_g: string;
  target_fat_g: string;
  target_fiber_g: string;
  target_sugar_max_g: string;
};

export const EMPTY: FormState = {
  weight_kg: "",
  height_cm: "",
  age: "",
  sex: "female",
  activity_level: "moderate",
  goal: "maintain",
  goal_rate: "moderate",
  target_calories: "",
  target_protein_g: "",
  target_carbs_g: "",
  target_fat_g: "",
  target_fiber_g: "",
  target_sugar_max_g: "",
};

export function num(v: string): number | null {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || Number.isNaN(n) ? null : n;
}

/**
 * Gemeinsames Formular-State-Handling für Körperdaten und Ziel-Werte.
 * Speichert immer das komplette Profil, damit Unterseiten sich nicht
 * gegenseitig überschreiben.
 */
export function useGoalsForm() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { profile, isLoading } = useNutritionTargets();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [manual, setManual] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || isLoading) return;
    if (profile) {
      setForm({
        weight_kg: profile.weight_kg != null ? String(profile.weight_kg) : "",
        height_cm: profile.height_cm != null ? String(profile.height_cm) : "",
        age: profile.age != null ? String(profile.age) : "",
        sex: (profile.sex as Sex) ?? "female",
        activity_level: (profile.activity_level as ActivityLevel) ?? "moderate",
        goal: (profile.goal as Goal) ?? "maintain",
        goal_rate: (profile.goal_rate as GoalRate) ?? "moderate",
        target_calories:
          profile.target_calories != null ? String(profile.target_calories) : "",
        target_protein_g:
          profile.target_protein_g != null ? String(profile.target_protein_g) : "",
        target_carbs_g:
          profile.target_carbs_g != null ? String(profile.target_carbs_g) : "",
        target_fat_g: profile.target_fat_g != null ? String(profile.target_fat_g) : "",
        target_fiber_g:
          profile.target_fiber_g != null ? String(profile.target_fiber_g) : "",
        target_sugar_max_g:
          profile.target_sugar_max_g != null ? String(profile.target_sugar_max_g) : "",
      });
      setManual(profile.target_calories != null);
    }
    setHydrated(true);
  }, [profile, isLoading, hydrated]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const values = {
    weight_kg: num(form.weight_kg),
    height_cm: num(form.height_cm),
    age: num(form.age),
    sex: form.sex,
    activity_level: form.activity_level,
    goal: form.goal,
    goal_rate: form.goal_rate,
    target_calories: manual ? num(form.target_calories) : null,
    target_protein_g: manual ? num(form.target_protein_g) : null,
    target_carbs_g: manual ? num(form.target_carbs_g) : null,
    target_fat_g: manual ? num(form.target_fat_g) : null,
    target_fiber_g: manual ? num(form.target_fiber_g) : null,
    target_sugar_max_g: manual ? num(form.target_sugar_max_g) : null,
  };

  const preview = computeTargets(values);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      await saveUserProfile(user.id, values);
      // Ziel-Werte historisieren: gilt ab heute, vergangene Tage bleiben
      // mit ihren damaligen Zielen bewertet.
      await recordTargetsForToday(user.id, preview);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["user-profile"] });
      void qc.invalidateQueries({ queryKey: ["target-history"] });
      toast.success("Profil gespeichert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { form, set, manual, setManual, preview, mutation, isLoading };
}
