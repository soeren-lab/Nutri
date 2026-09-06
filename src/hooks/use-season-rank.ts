import { useUserRank } from "@/hooks/use-user-rank";

/**
 * Season-Sicht auf das Rang-System. Es gibt nur noch einen Rang – dieser Hook
 * ist ein Alias auf `useUserRank` und bleibt für bestehende Aufrufer erhalten.
 */
export function useSeasonRank(options?: { sync?: boolean }) {
  return useUserRank(options);
}
