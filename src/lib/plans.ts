import { supabase } from "@/integrations/supabase/client";

/** Abo-Stufen der App. */
export type PlanId = "free" | "pro" | "max";

/** Anzeigename einer Plan-Stufe. */
export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  pro: "Pro",
  max: "Max",
};

const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, max: 2 };

/** True, wenn `plan` mindestens die Stufe `min` hat (free < pro < max). */
export function planAtLeast(plan: PlanId, min: PlanId): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[min];
}

function toPlanId(value: unknown): PlanId {
  return value === "pro" || value === "max" ? value : "free";
}

/**
 * Plan des Users aus `user_plans` (nur lesbar, gesetzt wird er per service_role).
 * Keine Zeile oder unbekannter Wert = free.
 */
export function planQuery(userId: string | undefined) {
  return {
    queryKey: ["user-plan", userId ?? "anon"],
    enabled: !!userId,
    queryFn: async (): Promise<PlanId> => {
      const { data, error } = await supabase
        .from("user_plans")
        .select("plan")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return toPlanId(data?.plan);
    },
  };
}
