import { beforeEach, describe, expect, test, vi } from "vitest";

const rows = Array.from({ length: 502 }, (_, index) => ({
  id: `entry-${index}`,
  date: index < 251 ? "2026-09-01" : "2026-09-02",
  meal_slot: ["Frühstück", "Mittag", "Abend"][index % 3],
  food_type: index % 2 === 0 ? "recipe" : "unexpected-legacy-value",
  recipe_id: `recipe-${index}`,
  ingredient_master_id: null,
  recipe: null,
  ingredient: null,
}));

const requestedRanges: Array<[number, number]> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => {
      const builder = {
        select: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        lte: vi.fn(() => builder),
        order: vi.fn(() => builder),
        range: vi.fn(async (from: number, to: number) => {
          requestedRanges.push([from, to]);
          return { data: rows.slice(from, to + 1), error: null };
        }),
      };
      return builder;
    }),
  },
}));

vi.mock("@/lib/recipes", () => ({
  fetchRecipe: vi.fn(),
  fetchRecipes: vi.fn(),
}));

describe("fetchMealPlan", () => {
  beforeEach(() => requestedRanges.splice(0));

  test("loads every raw entry across pages without filtering slots or food types", async () => {
    const { fetchMealPlan } = await import("@/lib/meal-plan");
    const result = await fetchMealPlan("2026-09-01", "2026-09-02");

    expect(requestedRanges).toEqual([
      [0, 499],
      [500, 999],
    ]);
    expect(result).toHaveLength(502);
    expect(new Set(result.map((entry) => entry.meal_slot))).toEqual(
      new Set(["Frühstück", "Mittag", "Abend"]),
    );
    expect(result.some((entry) => entry.food_type === "unexpected-legacy-value")).toBe(true);
    expect(result.at(-1)?.id).toBe("entry-501");
  });
});