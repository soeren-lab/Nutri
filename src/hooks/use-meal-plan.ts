import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { cleanupBatchGroup } from "@/lib/batch";
import { lateNoticeFor, recalculatePointsForDate } from "@/lib/points";
import { ingredientsMasterQuery } from "@/lib/ingredients-master";
import { MUTATION_KEYS } from "@/lib/offline-mutations";
import type { RecipeListItem } from "@/types/recipe";
import type { IngredientMasterRow } from "@/lib/meal-plan";

import {
  MEAL_SLOTS,
  addFoodEntry,
  addQuickEntry,
  addRecipeEntry,
  copyMealPlanEntry,
  deleteMealPlanEntry,
  entryMacros,
  foodSnapshot,
  mealPlanQuery,
  recipeSnapshot,
  snapshotForPatch,
  startOfWeek,
  toISODate,
  updateMealPlanEntry,
  weekDates,
  type MacroTotals,
  type MealPlanEntryFull,
  type MealSlot,
} from "@/lib/meal-plan";

/** Schreibt einen (echten oder optimistischen) Eintrag in die Woche, zu der sein Datum gehört. */
function upsertEntryInWeekCache(qc: QueryClient, entry: MealPlanEntryFull) {
  const weekKey = ["meal-plan", toISODate(startOfWeek(new Date(entry.date)))];
  qc.setQueryData<MealPlanEntryFull[]>(weekKey, (old) => {
    const list = old ?? [];
    const idx = list.findIndex((e) => e.id === entry.id);
    if (idx === -1) return [...list, entry];
    return list.map((e, i) => (i === idx ? entry : e));
  });
}

function removeEntryFromCache(qc: QueryClient, id: string) {
  qc.setQueriesData<MealPlanEntryFull[]>({ queryKey: ["meal-plan"] }, (old) =>
    old?.filter((e) => e.id !== id),
  );
}

function lookupRecipe(qc: QueryClient, id: string): RecipeListItem | null {
  return qc.getQueryData<RecipeListItem[]>(["recipes"])?.find((r) => r.id === id) ?? null;
}

function lookupMaster(qc: QueryClient, id: string): IngredientMasterRow | null {
  return (
    qc
      .getQueryData<IngredientMasterRow[]>(ingredientsMasterQuery(true).queryKey)
      ?.find((m) => m.id === id) ??
    qc
      .getQueryData<IngredientMasterRow[]>(ingredientsMasterQuery(false).queryKey)
      ?.find((m) => m.id === id) ??
    null
  );
}

export type { MacroTotals } from "@/lib/meal-plan";
export { entryMacros, entryKcal, recipeNutritionPerServing } from "@/lib/meal-plan";

export function useMealPlan(weekStart: Date) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery(mealPlanQuery(weekStart));
  const entries = query.data ?? [];

  const days = useMemo(() => weekDates(weekStart), [weekStart]);

  const bySlot = useMemo(() => {
    const map = new Map<string, MealPlanEntryFull[]>();
    for (const e of entries) {
      const key = `${e.date}|${e.meal_slot}`;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [entries]);

  /** Alle Einträge eines Slots (kann mehrere sein). */
  const getEntries = (date: Date, slot: MealSlot): MealPlanEntryFull[] =>
    bySlot.get(`${toISODate(date)}|${slot}`) ?? [];

  /** Summierte Makros aller geplanten Einträge eines Tages. */
  const dayTotals = (date: Date): MacroTotals | null => {
    const iso = toISODate(date);
    const sum: MacroTotals = {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
    };
    let any = false;
    for (const slot of MEAL_SLOTS) {
      for (const e of bySlot.get(`${iso}|${slot}`) ?? []) {
        const m = entryMacros(e);
        if (!m) continue;
        sum.calories += m.calories;
        sum.protein_g += m.protein_g;
        sum.carbs_g += m.carbs_g;
        sum.fat_g += m.fat_g;
        sum.fiber_g += m.fiber_g;
        sum.sugar_g = (sum.sugar_g ?? 0) + (m.sugar_g ?? 0);
        any = true;
      }
    }
    return any ? sum : null;
  };

  const dayKcal = (date: Date) => {
    const t = dayTotals(date);
    return t ? Math.round(t.calories) : null;
  };

  /** Durchschnittliche kcal pro Tag über die ganze Woche (7 Tage). */
  const weekAverageKcal = useMemo(() => {
    let sum = 0;
    for (const e of entries) sum += entryMacros(e)?.calories ?? 0;
    return entries.length > 0 ? sum / 7 : null;
  }, [entries]);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["meal-plan"] });
    void qc.invalidateQueries({ queryKey: ["daily-totals"] });
    void qc.invalidateQueries({ queryKey: ["batch-cook-week"] });
  }

  /**
   * Punkte des betroffenen Tages nach jeder Änderung neu berechnen –
   * so bleiben keine veralteten Punkte für gelöschte/geänderte Einträge stehen.
   */
  function recalcPoints(date: Date | string) {
    if (!user) return;
    void recalculatePointsForDate(user.id, date)
      .then(() => {
        void qc.invalidateQueries({ queryKey: ["user-points"] });
        void qc.invalidateQueries({ queryKey: ["points-log"] });
      })
      .catch(() => {});
  }

  const planRecipe = useMutation({
    mutationKey: MUTATION_KEYS.planRecipe,
    onMutate: async (v: {
      date: Date;
      slot: MealSlot;
      recipeId: string;
      servings: number | null;
      selectedVariantIds?: Record<string, string> | null;
      groupChoices?: Record<string, string> | null;
      inputMode?: "servings" | "grams";
      inputGramsValue?: number | null;
    }) => {
      if (!user) return;
      const snapshot = await recipeSnapshot(
        v.recipeId,
        v.servings,
        v.selectedVariantIds ?? null,
        v.groupChoices ?? null,
        qc,
      ).catch(() => null);
      if (!snapshot) return;
      const recipe = lookupRecipe(qc, v.recipeId);
      upsertEntryInWeekCache(qc, {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: toISODate(v.date),
        meal_slot: v.slot,
        food_type: "recipe",
        recipe_id: v.recipeId,
        servings: v.servings,
        sort_order: getEntries(v.date, v.slot).length,
        selected_variant_ids: v.selectedVariantIds ?? null,
        group_choices: v.groupChoices ?? null,
        input_mode: v.inputMode ?? "servings",
        input_grams_value: v.inputGramsValue ?? null,
        batch_group_id: null,
        batch_role: "none",
        batch_cook_date: null,
        days_late: 0,
        amount: null,
        unit: null,
        ingredient_master_id: null,
        quick_entry_name: null,
        quick_entry_calories: null,
        quick_entry_protein_g: null,
        quick_entry_carbs_g: null,
        quick_entry_fat_g: null,
        quick_entry_fiber_g: null,
        quick_entry_sugar_g: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...snapshot,
        recipe: recipe as unknown as MealPlanEntryFull["recipe"],
        ingredient: null,
      } as unknown as MealPlanEntryFull);
    },
    mutationFn: (v: {
      date: Date;
      slot: MealSlot;
      recipeId: string;
      servings: number | null;
      selectedVariantIds?: Record<string, string> | null;
      groupChoices?: Record<string, string> | null;
      inputMode?: "servings" | "grams";
      inputGramsValue?: number | null;
    }) => {
      if (!user) throw new Error("Nicht angemeldet");
      return addRecipeEntry({
        userId: user.id,
        date: toISODate(v.date),
        meal_slot: v.slot,
        recipe_id: v.recipeId,
        servings: v.servings,
        selected_variant_ids: v.selectedVariantIds ?? null,
        group_choices: v.groupChoices ?? null,
        input_mode: v.inputMode ?? "servings",
        input_grams_value: v.inputGramsValue ?? null,
        sort_order: getEntries(v.date, v.slot).length,
        qc,
      });
    },

    onSuccess: (_data, v) => {
      invalidate();
      recalcPoints(v.date);
      const notice = lateNoticeFor(v.date);
      toast.success("Eingeplant", notice ? { description: notice } : undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const planFood = useMutation({
    mutationKey: MUTATION_KEYS.planFood,
    onMutate: async (v: {
      date: Date;
      slot: MealSlot;
      ingredientId: string;
      amount: number;
      unit: string;
    }) => {
      if (!user) return;
      const snapshot = await foodSnapshot(v.ingredientId, v.amount, v.unit, qc).catch(() => null);
      if (!snapshot) return;
      const master = lookupMaster(qc, v.ingredientId);
      upsertEntryInWeekCache(qc, {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: toISODate(v.date),
        meal_slot: v.slot,
        food_type: "ingredient",
        ingredient_master_id: v.ingredientId,
        amount: v.amount,
        unit: v.unit,
        sort_order: getEntries(v.date, v.slot).length,
        recipe_id: null,
        servings: null,
        selected_variant_ids: null,
        group_choices: null,
        input_mode: null,
        input_grams_value: null,
        batch_group_id: null,
        batch_role: "none",
        batch_cook_date: null,
        days_late: 0,
        quick_entry_name: null,
        quick_entry_calories: null,
        quick_entry_protein_g: null,
        quick_entry_carbs_g: null,
        quick_entry_fat_g: null,
        quick_entry_fiber_g: null,
        quick_entry_sugar_g: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...snapshot,
        recipe: null,
        ingredient: master,
      } as unknown as MealPlanEntryFull);
    },
    mutationFn: (v: {
      date: Date;
      slot: MealSlot;
      ingredientId: string;
      amount: number;
      unit: string;
    }) => {
      if (!user) throw new Error("Nicht angemeldet");
      return addFoodEntry({
        userId: user.id,
        date: toISODate(v.date),
        meal_slot: v.slot,
        ingredient_master_id: v.ingredientId,
        amount: v.amount,
        unit: v.unit,
        sort_order: getEntries(v.date, v.slot).length,
        qc,
      });
    },
    onSuccess: (_data, v) => {
      invalidate();
      recalcPoints(v.date);
      const notice = lateNoticeFor(v.date);
      toast.success("Eingeplant", notice ? { description: notice } : undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const planQuick = useMutation({
    mutationKey: MUTATION_KEYS.planQuick,
    onMutate: (v: {
      date: Date;
      slot: MealSlot;
      name: string;
      calories: number;
      protein_g: number | null;
      carbs_g: number | null;
      fat_g: number | null;
      fiber_g: number | null;
      sugar_g?: number | null;
    }) => {
      if (!user) return;
      upsertEntryInWeekCache(qc, {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: toISODate(v.date),
        meal_slot: v.slot,
        food_type: "quick_entry",
        sort_order: getEntries(v.date, v.slot).length,
        recipe_id: null,
        ingredient_master_id: null,
        servings: null,
        amount: null,
        unit: null,
        selected_variant_ids: null,
        group_choices: null,
        input_mode: null,
        input_grams_value: null,
        batch_group_id: null,
        batch_role: "none",
        batch_cook_date: null,
        days_late: 0,
        quick_entry_name: v.name,
        quick_entry_calories: v.calories,
        quick_entry_protein_g: v.protein_g,
        quick_entry_carbs_g: v.carbs_g,
        quick_entry_fat_g: v.fat_g,
        quick_entry_fiber_g: v.fiber_g,
        quick_entry_sugar_g: v.sugar_g ?? null,
        snapshot_name: v.name,
        snapshot_calories: v.calories,
        snapshot_protein_g: v.protein_g,
        snapshot_carbs_g: v.carbs_g,
        snapshot_fat_g: v.fat_g,
        snapshot_fiber_g: v.fiber_g,
        snapshot_sugar_g: v.sugar_g ?? null,
        snapshot_variant_label: null,
        snapshot_ingredients: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        recipe: null,
        ingredient: null,
      } as unknown as MealPlanEntryFull);
    },
    mutationFn: (v: {
      date: Date;
      slot: MealSlot;
      name: string;
      calories: number;
      protein_g: number | null;
      carbs_g: number | null;
      fat_g: number | null;
      fiber_g: number | null;
      sugar_g?: number | null;
    }) => {
      if (!user) throw new Error("Nicht angemeldet");
      return addQuickEntry({
        userId: user.id,
        date: toISODate(v.date),
        meal_slot: v.slot,
        name: v.name,
        calories: v.calories,
        protein_g: v.protein_g,
        carbs_g: v.carbs_g,
        fat_g: v.fat_g,
        fiber_g: v.fiber_g,
        sugar_g: v.sugar_g ?? null,
        sort_order: getEntries(v.date, v.slot).length,
      });
    },
    onSuccess: (_data, v) => {
      invalidate();
      recalcPoints(v.date);
      const notice = lateNoticeFor(v.date);
      toast.success("Eingeplant", notice ? { description: notice } : undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type UpdatePatch = {
    id: string;
    servings?: number | null;
    input_mode?: "servings" | "grams";
    input_grams_value?: number | null;
    amount?: number | null;
    unit?: string | null;
    date?: string;
    meal_slot?: MealSlot;
    skipped?: boolean;
    selected_variant_ids?: Record<string, string> | null;
    group_choices?: Record<string, string> | null;
    quick_entry_name?: string;
    quick_entry_calories?: number | null;
    quick_entry_protein_g?: number | null;
    quick_entry_carbs_g?: number | null;
    quick_entry_fat_g?: number | null;
    quick_entry_fiber_g?: number | null;
    quick_entry_sugar_g?: number | null;
  };

  const update = useMutation({
    mutationKey: MUTATION_KEYS.updateMealPlanEntry,
    onMutate: async (v: UpdatePatch) => {
      const { id, ...patch } = v;
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      const snapshot = await snapshotForPatch(entry, patch, qc).catch(() => null);
      const updated = { ...entry, ...patch, ...(snapshot ?? {}) } as MealPlanEntryFull;
      if (patch.date && patch.date !== entry.date) {
        removeEntryFromCache(qc, id);
      }
      upsertEntryInWeekCache(qc, updated);
    },
    mutationFn: async (v: UpdatePatch) => {
      const { id, ...patch } = v;
      const entry = entries.find((e) => e.id === id);
      // Ändert der Nutzer Menge/Portionen/Variante selbst, wird der Snapshot
      // neu festgeschrieben – sonst bleibt er unverändert.
      const snapshot = entry ? await snapshotForPatch(entry, patch, qc) : null;
      // Beim Verschieben eines verknüpften Eintrags die Batch-Rolle mitziehen.
      const rolePatch =
        entry?.batch_group_id && patch.date
          ? {
              batch_role: (patch.date === entry.batch_cook_date ? "start" : "leftover") as
                | "start"
                | "leftover",
            }
          : {};
      await updateMealPlanEntry(id, { ...patch, ...(snapshot ?? {}), ...rolePatch });
      if (entry?.batch_group_id && patch.date) {
        await cleanupBatchGroup(entry.batch_group_id).catch(() => {});
      }
      // Beide Tage melden: bei Verschieben ändern sich alter und neuer Tag.
      return { dates: [entry?.date, patch.date].filter(Boolean) as string[] };
    },
    onSuccess: (res) => {
      invalidate();
      for (const d of res.dates) recalcPoints(d);
      toast.success("Aktualisiert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Eintrag auf beliebig viele Tage/Slots kopieren. */
  const copy = useMutation({
    mutationFn: async (v: { entry: MealPlanEntryFull; dates: string[]; slot: MealSlot }) => {
      if (!user) throw new Error("Nicht angemeldet");
      for (const date of v.dates) {
        const existing = entries.filter((e) => e.date === date && e.meal_slot === v.slot).length;
        await copyMealPlanEntry({
          entry: v.entry,
          userId: user.id,
          date,
          meal_slot: v.slot,
          sort_order: existing,
          qc,
        });
      }
      return { dates: v.dates };
    },
    onSuccess: (res) => {
      invalidate();
      for (const d of res.dates) recalcPoints(d);
      toast.success(res.dates.length > 1 ? `Auf ${res.dates.length} Tage kopiert` : "Kopiert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationKey: MUTATION_KEYS.removeMealPlanEntry,
    onMutate: (id: string) => {
      removeEntryFromCache(qc, id);
    },
    mutationFn: async (id: string) => {
      const entry = entries.find((e) => e.id === id) ?? null;
      const date = entry?.date ?? null;
      await deleteMealPlanEntry(id);
      // Verwaiste Batch-Verknüpfungen der übrigen Tage aufräumen.
      await cleanupBatchGroup(entry?.batch_group_id ?? null).catch(() => {});
      return { date };
    },
    onSuccess: (res) => {
      invalidate();
      if (res.date) recalcPoints(res.date);
      toast.success("Entfernt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    days,
    entries,
    getEntries,
    dayKcal,
    dayTotals,
    weekAverageKcal,
    isLoading: query.isLoading,
    planRecipe,
    planFood,
    planQuick,
    update,
    copy,
    remove,
  };
}
