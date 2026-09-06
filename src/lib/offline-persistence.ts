import { get, set, del } from "idb-keyval";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { onlineManager, type Query, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { warmOfflineCache } from "@/lib/offline-sync";

/**
 * Diese Bereiche werden lokal (IndexedDB) gecacht/wiederhergestellt und
 * offline geschrieben – Rezepte, Zutaten, Planer, Einkaufsliste sowie die
 * signierten Bild-URLs dazu (siehe getSignedImageUrl/getIngredientSignedUrl:
 * ohne Persistenz verschwinden Rezept-/Zutatenbilder nach einem Neustart
 * offline komplett, auch wenn sie vorher schon geladen waren). `favorites`
 * und `brands` sind mit dabei, weil Rezept-Detail- bzw. Zutaten-Seiten sie
 * über useSuspenseQuery zwingend brauchen – ohne Persistenz hängt die ganze
 * Seite offline unauflösbar fest, sobald sie diese Session noch nicht
 * geladen wurden. Alles andere (Freunde, Punkte, Community, ...) bleibt
 * bewusst rein im Speicher/online-only.
 */
const OFFLINE_QUERY_PREFIXES: QueryKey[] = [
  ["recipes"],
  ["ingredients_master"],
  ["meal-plan"],
  ["shopping-list"],
  ["signed-image"],
  ["signed-ingredient-image"],
  ["favorites"],
  ["brands"],
];

function isOfflineScoped(queryKey: QueryKey): boolean {
  return OFFLINE_QUERY_PREFIXES.some((prefix) =>
    prefix.every((part, i) => queryKey[i] === part),
  );
}

/**
 * Richtet Offline-Persistenz für die oben gelisteten Bereiche ein:
 * - Erfolgreiche Query-Ergebnisse landen in IndexedDB und werden beim
 *   nächsten App-Start sofort angezeigt, auch ganz ohne Netzwerk.
 * - Pausierte (offline ausgelöste) Mutationen überleben ebenfalls einen
 *   App-Neustart und werden automatisch gesendet, sobald wieder online.
 */
export function setupOfflinePersistence(queryClient: QueryClient): Promise<void> {
  const persister = createAsyncStoragePersister({
    key: "nutri-offline-cache",
    storage: { getItem: get, setItem: set, removeItem: del },
  });

  // persistQueryClient gibt [unsubscribe, restorePromise] zurück. Der Aufrufer
  // (getRouter in router.tsx) wartet auf das Promise, BEVOR die App rendert –
  // sonst fragen die ersten useQuery-Aufrufe die Query-Keys ab, bevor der
  // IndexedDB-Restore (asynchron) überhaupt fertig ist, und starten offline
  // einen Fetch ins Leere statt die bereits vorhandenen Daten zu zeigen.
  const [, restored] = persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 Tage
    dehydrateOptions: {
      // Es zählt, ob überhaupt schon einmal gute Daten da waren – nicht, ob
      // der ZULETZT versuchte Fetch erfolgreich war. Ein einzelner Fehlschlag
      // (z. B. offline) darf einen vorher erfolgreich persistierten "letzten
      // bekannten Stand" nicht aus IndexedDB löschen, sonst geht er beim
      // nächsten Speicherzyklus (der den gesamten Cache neu schreibt) verloren.
      shouldDehydrateQuery: (query: Query) =>
        isOfflineScoped(query.queryKey) && query.state.data !== undefined,
      // Standardverhalten beibehalten: pausierte (offline ausgelöste)
      // Mutationen werden unabhängig vom Query-Key persistiert – es gibt
      // ohnehin nur wenige Schreibvorgänge in der App, das lohnt keine
      // eigene Filterung nach mutationKey.
    },
  });

  function syncOfflineDomain() {
    for (const prefix of OFFLINE_QUERY_PREFIXES) {
      void queryClient.invalidateQueries({ queryKey: prefix });
    }
  }

  // Pausierte Mutationen abspielen, sobald wieder online – sowohl beim
  // tatsächlichen Offline→Online-Übergang als auch direkt nach dem Boot,
  // falls das Gerät zu dem Zeitpunkt (z. B. App offline geschlossen, später
  // wieder mit Netz geöffnet) bereits online ist. Ohne den Boot-Check würde
  // in diesem – sehr häufigen – Fall nie ein "online"-Event mehr feuern und
  // eine offline gespeicherte Änderung bliebe für immer ungesendet liegen.
  // Wärmt proaktiv den Offline-Cache für alle eigenen Rezepte/Zutaten (inkl.
  // Bilder) vor – unabhängig davon, ob die jeweilige Seite je besucht wurde.
  // Läuft unabhängig von resumePausedMutations (Schreiben vs. Lesen, keine
  // Reihenfolge nötig) mit eigenem catch, damit ein Sync-Fehler nie zu einer
  // unbehandelten Promise-Ablehnung wird.
  function warmCache() {
    void warmOfflineCache(queryClient).catch(() => {});
  }

  void restored.then(() => {
    if (onlineManager.isOnline()) {
      void queryClient.resumePausedMutations().then(syncOfflineDomain);
      warmCache();
    }
    onlineManager.subscribe((isOnline) => {
      if (isOnline) {
        void queryClient.resumePausedMutations().then(syncOfflineDomain);
        warmCache();
      }
    });
  });

  return restored;
}
