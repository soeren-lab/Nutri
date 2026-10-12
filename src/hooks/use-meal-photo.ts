import { useQuery } from "@tanstack/react-query";
import { mealPhotoSignedUrl } from "@/lib/meal-plan";

/** Signierte URL für das private Essensfoto eines Foto-Scan-Eintrags (null ohne Foto). */
export function useMealPhotoUrl(path: string | null | undefined): string | null {
  const query = useQuery({
    queryKey: ["meal-photo-url", path],
    queryFn: () => mealPhotoSignedUrl(path!),
    enabled: !!path,
    staleTime: 1000 * 60 * 50,
  });
  return query.data ?? null;
}
