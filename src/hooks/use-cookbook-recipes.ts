import { useSuspenseQuery } from "@tanstack/react-query";
import { cookbookRecipesQuery } from "@/lib/cookbooks";

export function useCookbookRecipes(cookbookId: string) {
  return useSuspenseQuery(cookbookRecipesQuery(cookbookId));
}
