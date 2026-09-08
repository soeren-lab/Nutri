import type { ReactNode } from "react";

/**
 * Reiner Abstands-Wrapper für mehrere Einträge im selben Meal-Slot – kein
 * eigener Hintergrund/Rahmen mehr, damit nur die einzelne Eintrags-Karte
 * (MealEntryRow) als Glass-Karte sichtbar ist.
 */
export function MealSlotBorder({ children }: { children: ReactNode }) {
  return <div className="w-full space-y-1.5">{children}</div>;
}
