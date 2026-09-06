import { describe, expect, test } from "vitest";
import { aggregateLoadedShoppingEntries } from "@/lib/shopping-list";
import type { MealPlanEntryFull } from "@/lib/meal-plan";
import type { IngredientWithMaster, RecipeNode } from "@/types/recipe";

const master = (id: string, name: string) =>
  ({ id, name, unit: "g", category: "Sonstiges" }) as IngredientWithMaster["master"];

const ingredient = (
  id: string,
  recipeId: string,
  name: string,
  amount: number,
  componentId: string | null = null,
  variantId: string | null = null,
) =>
  ({
    id,
    recipe_id: recipeId,
    name,
    amount,
    unit: "g",
    sort_order: 0,
    ingredient_master_id: id,
    component_id: componentId,
    variant_id: variantId,
    master: master(id, name),
  }) as IngredientWithMaster;

function entry(
  id: string,
  date: string,
  mealSlot: string,
  recipe: RecipeNode,
  foodType = "recipe",
): MealPlanEntryFull {
  return {
    id,
    date,
    meal_slot: mealSlot,
    recipe_id: recipe.id,
    ingredient_master_id: null,
    food_type: foodType,
    servings: 1,
    selected_variant_ids: { "component-choice": "variant-b" },
    group_choices: null,
    batch_role: "none",
    recipe,
    ingredient: null,
  } as unknown as MealPlanEntryFull;
}

describe("shopping-list aggregation", () => {
  test("includes every entry across all days and meal slots, including nested and selected ingredients", () => {
    const linked = {
      id: "linked",
      servings: 1,
      ingredients: [ingredient("nested", "linked", "Basilikum", 5)],
      components: [],
    } as unknown as RecipeNode;
    const recipe = {
      id: "recipe",
      servings: 1,
      ingredients: [
        ingredient("free", "recipe", "Reis", 100),
        ingredient("fixed", "recipe", "Tomate", 50, "component-fixed"),
        ingredient("choice-a", "recipe", "Apfel", 20, "component-choice", "variant-a"),
        ingredient("choice-b", "recipe", "Birne", 30, "component-choice", "variant-b"),
      ],
      components: [
        {
          id: "component-fixed",
          servings: 1,
          component_type: "fixed",
          ingredients: [ingredient("fixed", "recipe", "Tomate", 50, "component-fixed")],
          variants: [],
          linked_recipe_id: null,
          linked: null,
        },
        {
          id: "component-choice",
          servings: 1,
          component_type: "choice",
          ingredients: [
            ingredient("choice-a", "recipe", "Apfel", 20, "component-choice", "variant-a"),
            ingredient("choice-b", "recipe", "Birne", 30, "component-choice", "variant-b"),
          ],
          variants: [
            { id: "variant-a", sort_order: 0, is_default: true },
            { id: "variant-b", sort_order: 1, is_default: false },
          ],
          linked_recipe_id: null,
          linked: null,
        },
        {
          id: "component-linked",
          servings: 1,
          component_type: "fixed",
          ingredients: [],
          variants: [],
          linked_recipe_id: "linked",
          linked,
        },
      ],
    } as unknown as RecipeNode;
    const entries = [
      entry("breakfast", "2026-09-01", "Frühstück", recipe),
      entry("lunch", "2026-09-02", "Mittag", recipe, "quick_entry"),
      entry("dinner", "2026-09-03", "Abend", recipe),
    ];

    const result = aggregateLoadedShoppingEntries(
      entries,
      new Map([
        [recipe.id, recipe],
        [linked.id, linked],
      ]),
      [],
    );
    const amounts = new Map(result.map((row) => [row.name, row.amount]));

    expect(entries).toHaveLength(3);
    expect(result.map((row) => row.name).sort()).toEqual(
      ["Basilikum", "Birne", "Reis", "Tomate"].sort(),
    );
    expect(amounts.get("Reis")).toBe(300);
    expect(amounts.get("Tomate")).toBe(150);
    expect(amounts.get("Birne")).toBe(90);
    expect(amounts.get("Basilikum")).toBe(15);
    expect(amounts.has("Apfel")).toBe(false);
  });
});