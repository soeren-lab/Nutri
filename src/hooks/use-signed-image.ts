import { useQuery } from "@tanstack/react-query";
import { getSignedImageUrl } from "@/lib/recipes";
import { getIngredientSignedUrl } from "@/lib/ingredients-master";

export function useSignedImage(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-image", path],
    queryFn: () => (path ? getSignedImageUrl(path) : Promise.resolve(null)),
    enabled: !!path,
    staleTime: 1000 * 60 * 60,
  });
}

export function useSignedIngredientImage(path: string | null | undefined) {
  // Externe Quellen (z. B. Open Food Facts) speichern eine absolute URL.
  const isExternal = !!path && /^https?:\/\//i.test(path);
  const query = useQuery({
    queryKey: ["signed-ingredient-image", path],
    queryFn: () => (path ? getIngredientSignedUrl(path) : Promise.resolve(null)),
    enabled: !!path && !isExternal,
    staleTime: 1000 * 60 * 60,
  });
  if (isExternal) return { ...query, data: path as string | null };
  return query;
}
