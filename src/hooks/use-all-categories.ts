import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { recipesQuery } from "@/lib/recipes";
import { RECIPE_CATEGORIES, type RecipeListItem } from "@/types/recipe";

export function recipeCategoriesOf(r: Pick<RecipeListItem, "categories" | "category">): string[] {
  return r.categories && r.categories.length > 0 ? r.categories : r.category ? [r.category] : [];
}

/** Aggregiert alle tatsächlich verwendeten Kategorien + feste Standardliste. */
export function aggregateCategories(
  recipes: Array<Pick<RecipeListItem, "categories" | "category">>,
): string[] {
  const set = new Set<string>(RECIPE_CATEGORIES);
  recipes.forEach((r) => recipeCategoriesOf(r).forEach((c) => set.add(c)));
  return Array.from(set);
}

/** Kategorien aus allen Rezepten – so erscheinen neue Kategorien überall. */
export function useAllCategories(): string[] {
  const { data } = useQuery(recipesQuery());
  return useMemo(() => aggregateCategories(data ?? []), [data]);
}
