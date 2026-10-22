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
import { addDays, mealPlanQuery, startOfWeek } from "@/lib/meal-plan";
import { batchCookWeekQuery } from "@/lib/batch";
import { shoppingListQuery } from "@/lib/shopping-list";
import { fridgeQuery } from "@/lib/fridge";
import { userProfileQuery } from "@/lib/nutritionTargets";
import { targetHistoryQuery } from "@/lib/targetHistory";
import { platesQuery } from "@/lib/plates";
import { quickEntryTemplatesQuery } from "@/lib/quick-entries";
import { bodyMeasurementsQuery } from "@/lib/bodyMeasurements";
import { userPointsQuery } from "@/lib/points";
import { achievementsQuery } from "@/lib/achievements";
import { creditBalanceQuery } from "@/lib/credits";
import { planQuery } from "@/lib/plans";
import { avatarQuery } from "@/lib/avatar";
import { usernameQuery } from "@/lib/username";

const CONCURRENCY = 6;
// Planer-Verlauf offline: so viele Wochen zurück und voraus werden vorgeladen.
const WEEKS_BACK = 8;
const WEEKS_AHEAD = 2;
const OLD_WEEK_STALE_MS = 6 * 60 * 60 * 1000;

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
 * Lädt die eigentlichen Bilddaten (nicht nur die signierte URL) über ein
 * echtes `<img>`-Element, statt per `fetch()`. Nur so setzt der Browser
 * `request.destination === "image"` – genau das Kriterium, nach dem der
 * Service Worker (vite.config.ts, Cache `images-v2`) entscheidet, ob eine
 * Antwort gecacht wird. Eine bereits im TanStack-Query-Cache liegende
 * signierte URL allein reicht nicht: das `<img>`-Tag der jeweiligen Seite
 * lädt die Bytes erst beim tatsächlichen Rendern, und ohne dieses Preload
 * hätte der Service Worker sie nie gesehen, wenn das Bild vorher noch nie
 * sichtbar gerendert wurde.
 */
function preloadImageBytes(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // ein einzelnes Bild darf den Sync nie blockieren
    img.src = url;
  });
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
  const userId = await currentUserId();
  if (!userId) return;

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
  // Eigene Favoriten – kostet wenig, wird aber von der Rezept-Detailseite
  // per useSuspenseQuery zwingend gebraucht (siehe recipes.$id.index.tsx).
  await queryClient.fetchQuery(favoritesQuery(userId)).catch(() => {});

  // Zuerst das, was der Alltag braucht: Planer-Verlauf und alles rund ums Profil. Fehler einzelner
  // Abfragen stoppen den Rest nicht.
  const baseWeek = startOfWeek(new Date());
  const planTasks: Array<() => Promise<unknown>> = [];
  for (let k = -WEEKS_BACK; k <= WEEKS_AHEAD; k++) {
    const week = addDays(baseWeek, 7 * k);
    // Lange vergangene Wochen ändern sich nicht mehr: nur alle paar Stunden neu laden.
    const staleTime = k < -1 ? OLD_WEEK_STALE_MS : 0;
    planTasks.push(() => queryClient.fetchQuery({ ...mealPlanQuery(week), staleTime }));
    planTasks.push(() => queryClient.fetchQuery({ ...batchCookWeekQuery(week), staleTime }));
  }
  const profileTasks: Array<() => Promise<unknown>> = [
    () => queryClient.fetchQuery(userProfileQuery()),
    () => queryClient.fetchQuery(targetHistoryQuery()),
    () => queryClient.fetchQuery(platesQuery()),
    () => queryClient.fetchQuery(quickEntryTemplatesQuery()),
    () => queryClient.fetchQuery(shoppingListQuery()),
    () => queryClient.fetchQuery(fridgeQuery()),
    () => queryClient.fetchQuery(bodyMeasurementsQuery()),
    () => queryClient.fetchQuery(userPointsQuery()),
    () => queryClient.fetchQuery(achievementsQuery()),
    () => queryClient.fetchQuery(creditBalanceQuery(userId)),
    () => queryClient.fetchQuery(planQuery(userId)),
    () => queryClient.fetchQuery(avatarQuery(userId)),
    () => queryClient.fetchQuery(usernameQuery(userId)),
  ];
  await mapWithConcurrency([...profileTasks, ...planTasks], 3, async (task) => {
    await task();
  });

  const recipeImageTasks: Array<() => Promise<void>> = [];
  const ingredientImageTasks: Array<() => Promise<void>> = [];
  const detailTasks: Array<() => Promise<void>> = [];

  for (const recipe of recipes) {
    detailTasks.push(() => queryClient.fetchQuery(recipeQuery(recipe.id)).then(() => {}));
    if (recipe.image_url) {
      const path = recipe.image_url;
      recipeImageTasks.push(() =>
        queryClient.fetchQuery(signedImageQuery(path)).then(
          async (url) => {
            if (url) await preloadImageBytes(url);
          },
          (err) => {
            console.warn(`[Offline-Sync] Rezeptbild fehlgeschlagen: ${recipe.title}`, err);
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
          async (url) => {
            if (url) await preloadImageBytes(url);
          },
          (err) => {
            console.warn(`[Offline-Sync] Zutatbild fehlgeschlagen: ${master.name}`, err);
            throw err;
          },
        ),
      );
    }
  }

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
  await mapWithConcurrency(detailTasks, CONCURRENCY, (task) => task());
}
