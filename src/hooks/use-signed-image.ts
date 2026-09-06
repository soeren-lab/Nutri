import { queryOptions, useQuery } from "@tanstack/react-query";
import { getSignedImageUrl } from "@/lib/recipes";
import { getIngredientSignedUrl } from "@/lib/ingredients-master";

/** Externe Quellen (z. B. Open Food Facts) speichern eine absolute URL statt eines Storage-Pfads. */
export const isExternalImagePath = (path: string | null | undefined): boolean =>
  !!path && /^https?:\/\//i.test(path);

/**
 * Als `queryOptions()`-Factory exportiert (statt nur im Hook verwendet), damit
 * `src/lib/offline-sync.ts` per `ensureQueryData` denselben Cache-Eintrag
 * warmhalten kann, den `useSignedImage` liest – zwei getrennte Definitionen
 * für denselben Query-Key würden sonst leicht auseinanderlaufen.
 */
export const signedImageQuery = (path: string | null | undefined) =>
  queryOptions({
    queryKey: ["signed-image", path],
    queryFn: () => (path ? getSignedImageUrl(path) : Promise.resolve(null)),
    enabled: !!path,
    staleTime: 1000 * 60 * 60,
  });

export const signedIngredientImageQuery = (path: string | null | undefined) =>
  queryOptions({
    queryKey: ["signed-ingredient-image", path],
    queryFn: () => (path ? getIngredientSignedUrl(path) : Promise.resolve(null)),
    enabled: !!path && !isExternalImagePath(path),
    staleTime: 1000 * 60 * 60,
  });

export function useSignedImage(path: string | null | undefined) {
  return useQuery(signedImageQuery(path));
}

export function useSignedIngredientImage(path: string | null | undefined) {
  const query = useQuery(signedIngredientImageQuery(path));
  if (isExternalImagePath(path)) return { ...query, data: path as string | null };
  return query;
}
