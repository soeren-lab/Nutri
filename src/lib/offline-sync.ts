import type { QueryClient } from "@tanstack/react-query";
import { currentUserId } from "@/lib/auth-session";
import { recipesQuery, recipeQuery, favoritesQuery } from "@/lib/recipes";
import { ingredientsMasterQuery } from "@/lib/ingredients-master";
import {
  signedImageQuery,
  signedIngredientImageQuery,
  isExternalImagePath,
} from "@/hooks/use-signed-image";
import { mapWithConcurrency } from "@/lib/concurrency";

const CONCURRENCY = 6;

/** Wechselt sich zwischen zwei Aufgabenlisten ab, statt sie hintereinanderzuhängen. */
function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const out: T[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/**
 * Wärmt den Offline-Cache proaktiv für alle eigenen Rezepte und Zutaten
 * (Detail-Daten inkl. Zubereitungsschritte + signierte Bild-URLs) vor –
 * nicht nur für Seiten, die tatsächlich besucht wurden. `recipes.index.tsx`
 * lädt nur die schlanke `["recipes"]`-Liste, nie die einzelnen
 * `["recipes", id]`-Detaildatensätze; ohne diesen Sync bleibt ein nie
 * einzeln geöffnetes Rezept offline unerreichbar.
 *
 * Läuft im Hintergrund (fire-and-forget), blockiert nie Rendering/Navigation.
 * Wird beim Boot (falls schon online) und bei jedem Offline→Online-Übergang
 * aufgerufen (siehe offline-persistence.ts).
 *
 * Bewusst `fetchQuery()`, NICHT `ensureQueryData()`: Letzteres holt Daten nur,
 * wenn der Cache-Eintrag noch komplett leer ist – ist einmal irgendein Stand
 * da (auch Stunden/Tage alt), liefert es ihn unverändert zurück und ignoriert
 * `staleTime` komplett. Für Rezepte/Zutaten (staleTime 0) hieße das: der
 * Sync würde nach dem allerersten erfolgreichen Lauf für immer dieselbe
 * eingefrorene Liste verwenden und neu hinzugefügte/geänderte Einträge nie
 * mehr entdecken – ihre Bilder würden dann nie geladen. `fetchQuery()`
 * respektiert `staleTime` tatsächlich und holt bei jedem Aufruf neu, wenn
 * die Daten (per `staleTime`) als veraltet gelten.
 */
export async function warmOfflineCache(queryClient: QueryClient): Promise<void> {
  if (typeof window === "undefined") return;
  console.warn("[Offline-Sync] warmOfflineCache gestartet");
  const userId = await currentUserId();
  if (!userId) {
    console.warn("[Offline-Sync] Kein Nutzer angemeldet, breche ab");
    return;
  }

  const [recipes, ingredients] = await Promise.all([
    queryClient.fetchQuery(recipesQuery()),
    queryClient.fetchQuery(ingredientsMasterQuery(false)),
    // Die Zutaten-Seite (ingredients.tsx) liest die includeArchived:true-
    // Variante – ein eigener Cache-Eintrag, den ensureQueryData() in ihrem
    // Loader (wie fetchQuery hier) nie von selbst auffrischt. Ohne diesen
    // Fetch bliebe dieser Stand für immer eingefroren (gcTime/maxAge:
    // Infinity), inkl. veralteter image_url-Pfade.
    queryClient.fetchQuery(ingredientsMasterQuery(true)),
  ]);
  console.warn(
    `[Offline-Sync] ${recipes.length} eigene Rezepte, ${ingredients.length} eigene Zutaten gefunden`,
  );
  // Eigene Favoriten – kostet wenig, wird aber von der Rezept-Detailseite
  // per useSuspenseQuery zwingend gebraucht (siehe recipes.$id.index.tsx).
  await queryClient.fetchQuery(favoritesQuery(userId)).catch(() => {});

  const recipeImageTasks: Array<() => Promise<void>> = [];
  const ingredientImageTasks: Array<() => Promise<void>> = [];
  const detailTasks: Array<() => Promise<void>> = [];

  for (const recipe of recipes) {
    detailTasks.push(() => queryClient.fetchQuery(recipeQuery(recipe.id)).then(() => {}));
    if (recipe.image_url) {
      const path = recipe.image_url;
      recipeImageTasks.push(() =>
        queryClient.fetchQuery(signedImageQuery(path)).then(
          (url) => {
            console.warn(
              `[Offline-Sync] Rezeptbild ok: ${recipe.title} -> ${url ? "URL erhalten" : "null"}`,
            );
          },
          (err) => {
            console.warn(
              `[Offline-Sync] Rezeptbild FEHLGESCHLAGEN: ${recipe.title} (${path})`,
              err,
            );
            throw err;
          },
        ),
      );
    }
  }

  for (const master of ingredients) {
    if (master.image_url && !isExternalImagePath(master.image_url)) {
      const path = master.image_url;
      ingredientImageTasks.push(() =>
        queryClient.fetchQuery(signedIngredientImageQuery(path)).then(
          (url) => {
            console.warn(
              `[Offline-Sync] Zutatbild ok: ${master.name} -> ${url ? "URL erhalten" : "null"}`,
            );
          },
          (err) => {
            console.warn(`[Offline-Sync] Zutatbild FEHLGESCHLAGEN: ${master.name} (${path})`, err);
            throw err;
          },
        ),
      );
    }
  }

  console.warn(
    `[Offline-Sync] ${recipeImageTasks.length} Rezeptbilder, ${ingredientImageTasks.length} Zutatenbilder, ${detailTasks.length} Rezept-Details zum Laden`,
  );

  // Bilder zuerst, und Rezept-/Zutatenbilder abwechselnd statt hintereinander –
  // sonst sind bei vielen Rezepten die Zutatenbilder (oder umgekehrt) noch
  // lange nicht an der Reihe, wenn der Nutzer währenddessen schon offline
  // geht. Die volle Rezept-Detailansicht (inkl. Zubereitungsschritte) ist für
  // die reinen Karten-/Übersichtsseiten nicht nötig und darf daher warten.
  await mapWithConcurrency(
    interleave(recipeImageTasks, ingredientImageTasks),
    CONCURRENCY,
    (task) => task(),
  );
  console.warn("[Offline-Sync] Bilder-Durchlauf fertig, starte Rezept-Details");
  await mapWithConcurrency(detailTasks, CONCURRENCY, (task) => task());
  console.warn("[Offline-Sync] warmOfflineCache fertig");
}
