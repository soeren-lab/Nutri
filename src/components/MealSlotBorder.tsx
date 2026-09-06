import type { ReactNode } from "react";

/**
 * Einfacher Container für eine komplette Meal-Slot-Gruppe (alle Einträge zusammen).
 * Kein animierter Rahmen mehr – nur die interne Trennlinie zwischen den Zeilen.
 */
export function MealSlotBorder({ children }: { children: ReactNode }) {
  return (
    <div className="w-full divide-y divide-border/60 overflow-hidden rounded-xl bg-card p-1">
      {children}
    </div>
  );
}
