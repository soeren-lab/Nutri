import { supabase } from "@/integrations/supabase/client";
import { resolveIngredients } from "@/lib/resolveIngredient";
import { addNutrition } from "@/lib/componentNutrition";
import type { RecipeComponentWithRelations, RecipeListItem } from "@/types/recipe";

/**
 * Erkennt Komponenten, die inhaltlich eine Beilage sind:
 * - Inline-Komponente mit „Beilage" im Namen, oder
 * - verlinktes Rezept mit Kategorie „Beilage".
 */
export function isSideDishComponent(c: RecipeComponentWithRelations): boolean {
  if (c.linked?.categories?.includes("Beilage")) return true;
  return /beilage/i.test(c.name);
}

export type SideDishCandidate = {
  recipe: RecipeListItem;
  components: RecipeComponentWithRelations[];
};

/** Alle Rezepte, die eine Beilagen-Komponente enthalten. */
export function findSideDishCandidates(recipes: RecipeListItem[]): SideDishCandidate[] {
  return recipes
    .map((recipe) => ({
      recipe,
      components: (recipe.components ?? []).filter(isSideDishComponent),
    }))
    .filter((c) => c.components.length > 0);
}

function positive(v: number | null | undefined) {
  return v != null && Number(v) > 0 ? Number(v) : 1;
}

/**
 * Extrahiert die Beilagen-Komponenten eines Rezepts:
 * inline Komponenten werden zu eigenen Rezepten (Kategorie „Beilage"),
 * verlinkte Komponenten bleiben als eigenständiges Rezept bestehen.
 * Danach wird die Komponente aus dem Ursprungsrezept entfernt.
 */
export async function extractSideDishes(candidate: SideDishCandidate): Promise<number> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Nicht angemeldet");

  let created = 0;
  for (const c of candidate.components) {
    if (!c.linked_recipe_id) {
      const rows = resolveIngredients(c.ingredients ?? []);
      const totals = addNutrition(
        ...rows.map((i) => ({
          calories: i.calories ?? 0,
          protein_g: i.protein_g ?? 0,
          carbs_g: i.carbs_g ?? 0,
          fat_g: i.fat_g ?? 0,
          fiber_g: i.fiber_g ?? 0,
          sugar_g: i.sugar_g ?? 0,
        })),
      );
      const servings = Math.round(positive(c.servings));
      const { data: newRecipe, error } = await supabase
        .from("recipes")
        .insert({
          user_id: uid,
          title: c.name.trim() || "Beilage",
          servings,
          categories: ["Beilage"],
          nutrition_mode: "advanced",
          calories: totals.calories,
          protein_g: totals.protein_g,
          carbs_g: totals.carbs_g,
          fat_g: totals.fat_g,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (rows.length > 0) {
        const { error: ingErr } = await supabase.from("ingredients").insert(
          (c.ingredients ?? []).map((i, idx) => ({
            recipe_id: newRecipe.id,
            name: i.name,
            amount: i.amount,
            unit: i.unit,
            sort_order: idx,
            ingredient_master_id: i.ingredient_master_id,
            calories: i.calories,
            protein_g: i.protein_g,
            carbs_g: i.carbs_g,
            fat_g: i.fat_g,
          })),
        );
        if (ingErr) throw ingErr;
      }
      created += 1;
    } else {
      // Verlinktes Rezept nur als Beilage kennzeichnen.
      const target = c.linked;
      if (target && !(target.categories ?? []).includes("Beilage")) {
        const { error } = await supabase
          .from("recipes")
          .update({ categories: [...(target.categories ?? []), "Beilage"] })
          .eq("id", c.linked_recipe_id);
        if (error) throw error;
      }
    }

    const { error: delErr } = await supabase.from("recipe_components").delete().eq("id", c.id);
    if (delErr) throw delErr;
  }
  return created;
}
