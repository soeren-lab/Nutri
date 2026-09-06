/**
 * KI-Vorschläge sind derzeit DEAKTIVIEREN-Zustand: es existiert bewusst kein
 * Server-Call und keine Gateway-Anbindung mehr in dieser Datei.
 * Der Planer nutzt ausschließlich die lokale Bibliotheks-Vorschlagslogik
 * (`src/lib/mealSuggestions.ts`).
 *
 * Nur die Typen bleiben erhalten, damit die UI-Komponenten unverändert
 * weiterverwendet werden können, falls die Funktion später bewusst wieder
 * aktiviert wird.
 */

/** Eine KI-generierte Mahlzeiten-Idee (nur Schätzwerte, nicht aus der Bibliothek). */
export type AiMealSuggestion = {
  name: string;
  description: string;
  estimated_kcal: number;
  estimated_protein_g: number;
  estimated_carbs_g: number;
  estimated_fat_g: number;
  estimated_fiber_g: number;
  main_ingredients: string[];
};

/** Feature-Flag: KI-Vorschläge sind abgeschaltet. */
export const AI_SUGGESTIONS_ENABLED = false as const;
