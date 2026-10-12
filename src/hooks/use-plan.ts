import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { planQuery, type PlanId } from "@/lib/plans";

/** Aktueller Abo-Plan des eingeloggten Users (Fallback: free). */
export function usePlan(): { plan: PlanId; isLoading: boolean } {
  const { user } = useAuth();
  const query = useQuery({ ...planQuery(user?.id), staleTime: 60_000 });
  return { plan: query.data ?? "free", isLoading: query.isLoading };
}
