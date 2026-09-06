import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cleanupBatchGroup } from "@/lib/batch";
import {
  addFoodEntry,
  addQuickEntry,
  addRecipeEntry,
  asDate,
  snapshotForPatch,
  startOfWeek,
  toISODate,
  updateMealPlanEntry,
  deleteMealPlanEntry,
  type MealPlanEntryFull,
  type MealPlanEntryPatch,
  type MealSlot,
} from "@/lib/meal-plan";
import { setItemChecked } from "@/lib/shopping-list";

/**
 * Stabile Keys für alle offline-fähigen Mutationen. Werden sowohl an den
 * jeweiligen `useMutation`-Aufrufen (für die normale In-App-Nutzung) als auch
 * an `registerOfflineMutationDefaults` (für den Resume-nach-Neustart-Fall)
 * verwendet – nur über den gleichen Key findet TanStack Query nach einer
 * Rehydration aus IndexedDB die passende mutationFn wieder.
 */
export const MUTATION_KEYS = {
  planRecipe: ["meal-plan", "plan-recipe"],
  planFood: ["meal-plan", "plan-food"],
  planQuick: ["meal-plan", "plan-quick"],
  updateMealPlanEntry: ["meal-plan", "update"],
  removeMealPlanEntry: ["meal-plan", "remove"],
  toggleShoppingItem: ["shopping-list", "toggle"],
} as const;

/**
 * Liest die User-ID direkt aus der von supabase-js persistierten Session
 * (kein Netzwerk-Roundtrip nötig, funktioniert offline) – dieselbe Quelle,
 * die auch `useAuth()` verwendet. Dadurch muss `userId` nicht zusätzlich in
 * jede Mutation-Variable aufgenommen werden.
 */
async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Nicht angemeldet");
  return userId;
}

/** Nächste sort_order für einen Slot, direkt aus dem (bereits hydrierten) Query-Cache gelesen. */
function nextSortOrder(qc: QueryClient, date: Date, slot: MealSlot): number {
  const weekKey = ["meal-plan", toISODate(startOfWeek(date))];
  const list = qc.getQueryData<MealPlanEntryFull[]>(weekKey) ?? [];
  const iso = toISODate(date);
  return list.filter((e) => e.date === iso && e.meal_slot === slot).length;
}

/** Sucht einen Planer-Eintrag anhand seiner ID über alle im Cache gehaltenen Wochen hinweg. */
function findEntryInCache(qc: QueryClient, id: string): MealPlanEntryFull | null {
  for (const [, data] of qc.getQueriesData<MealPlanEntryFull[]>({ queryKey: ["meal-plan"] })) {
    const found = data?.find((e) => e.id === id);
    if (found) return found;
  }
  return null;
}

/**
 * Registriert Fallback-mutationFns für Mutationen, die nach einem App-Neustart
 * aus IndexedDB wiederhergestellt werden. `dehydrateMutation` (TanStack Query)
 * persistiert nie die mutationFn/onSuccess/onError-Closures einer Mutation
 * (nicht serialisierbar) – ohne diese registrierten Defaults schlägt jeder
 * Resume-Versuch einer wiederhergestellten, pausierten Mutation mit
 * "No mutationFn found" fehl, was `resumePausedMutations()` bisher
 * stillschweigend verschluckt hat (siehe offline-persistence.ts).
 *
 * Muss vor der IndexedDB-Wiederherstellung aufgerufen werden, damit ein
 * sofortiger Resume-Versuch beim Boot nie auf einen unregistrierten Key trifft.
 */
export function registerOfflineMutationDefaults(qc: QueryClient) {
  qc.setMutationDefaults(MUTATION_KEYS.planRecipe, {
    mutationFn: async (v: {
      date: Date | string;
      slot: MealSlot;
      recipeId: string;
      servings: number | null;
      selectedVariantIds?: Record<string, string> | null;
      groupChoices?: Record<string, string> | null;
      inputMode?: "servings" | "grams";
      inputGramsValue?: number | null;
    }) => {
      const date = asDate(v.date);
      return addRecipeEntry({
        userId: await currentUserId(),
        date: toISODate(date),
        meal_slot: v.slot,
        recipe_id: v.recipeId,
        servings: v.servings,
        selected_variant_ids: v.selectedVariantIds ?? null,
        group_choices: v.groupChoices ?? null,
        input_mode: v.inputMode ?? "servings",
        input_grams_value: v.inputGramsValue ?? null,
        sort_order: nextSortOrder(qc, date, v.slot),
        qc,
      });
    },
  });

  qc.setMutationDefaults(MUTATION_KEYS.planFood, {
    mutationFn: async (v: {
      date: Date | string;
      slot: MealSlot;
      ingredientId: string;
      amount: number;
      unit: string;
    }) => {
      const date = asDate(v.date);
      return addFoodEntry({
        userId: await currentUserId(),
        date: toISODate(date),
        meal_slot: v.slot,
        ingredient_master_id: v.ingredientId,
        amount: v.amount,
        unit: v.unit,
        sort_order: nextSortOrder(qc, date, v.slot),
        qc,
      });
    },
  });

  qc.setMutationDefaults(MUTATION_KEYS.planQuick, {
    mutationFn: async (v: {
      date: Date | string;
      slot: MealSlot;
      name: string;
      calories: number;
      protein_g: number | null;
      carbs_g: number | null;
      fat_g: number | null;
      fiber_g: number | null;
      sugar_g?: number | null;
    }) => {
      const date = asDate(v.date);
      return addQuickEntry({
        userId: await currentUserId(),
        date: toISODate(date),
        meal_slot: v.slot,
        name: v.name,
        calories: v.calories,
        protein_g: v.protein_g,
        carbs_g: v.carbs_g,
        fat_g: v.fat_g,
        fiber_g: v.fiber_g,
        sugar_g: v.sugar_g ?? null,
        sort_order: nextSortOrder(qc, date, v.slot),
      });
    },
  });

  qc.setMutationDefaults(MUTATION_KEYS.updateMealPlanEntry, {
    mutationFn: async (v: { id: string } & MealPlanEntryPatch) => {
      const { id, ...patch } = v;
      const entry = findEntryInCache(qc, id);
      const snapshot = entry ? await snapshotForPatch(entry, patch, qc) : null;
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
    },
  });

  qc.setMutationDefaults(MUTATION_KEYS.removeMealPlanEntry, {
    mutationFn: async (id: string) => {
      const entry = findEntryInCache(qc, id);
      await deleteMealPlanEntry(id);
      await cleanupBatchGroup(entry?.batch_group_id ?? null).catch(() => {});
    },
  });

  qc.setMutationDefaults(MUTATION_KEYS.toggleShoppingItem, {
    mutationFn: (v: { id: string; checked: boolean }) => setItemChecked(v.id, v.checked),
  });
}
