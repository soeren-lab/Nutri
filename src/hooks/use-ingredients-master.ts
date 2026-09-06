import { useSuspenseQuery } from "@tanstack/react-query";
import { ingredientsMasterQuery, type IngredientMaster } from "@/lib/ingredients-master";

export function useIngredientsMaster(includeArchived = false): IngredientMaster[] {
  const { data } = useSuspenseQuery(ingredientsMasterQuery(includeArchived));
  return data;
}
