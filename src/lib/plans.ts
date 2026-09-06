/** Abo-Stufen der App. */
export type PlanId = "free" | "pro" | "max";

/** Aktueller Abo-Plan – später aus dem Abo-Status lesen. */
export const CURRENT_PLAN: PlanId = "free";

/** Anzeigename einer Plan-Stufe. */
export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  pro: "Pro",
  max: "Max",
};
