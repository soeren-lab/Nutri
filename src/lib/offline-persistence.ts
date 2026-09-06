import { get, set, del } from "idb-keyval";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query, QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Nur diese drei Bereiche werden lokal (IndexedDB) gecacht/wiederhergestellt
 * und offline geschrieben – Rezepte, Zutaten, Planer. Alles andere (Freunde,
 * Punkte, Community, ...) bleibt bewusst rein im Speicher/online-only.
 */
const OFFLINE_QUERY_PREFIXES: QueryKey[] = [["recipes"], ["ingredients_master"], ["meal-plan"]];

function isOfflineScoped(queryKey: QueryKey): boolean {
  return OFFLINE_QUERY_PREFIXES.some((prefix) =>
    prefix.every((part, i) => queryKey[i] === part),
  );
}

/**
 * Richtet Offline-Persistenz für Rezepte/Zutaten/Planer ein:
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
      // Nur erfolgreich geladene Daten persistieren – ein Fehlerzustand
      // (z. B. weil beim allerersten Laden schon offline) soll nicht als
      // "letzter bekannter Stand" überschreiben, was vorher schon da war.
      shouldDehydrateQuery: (query: Query) =>
        isOfflineScoped(query.queryKey) && query.state.status === "success",
      // Standardverhalten beibehalten: pausierte (offline ausgelöste)
      // Mutationen werden unabhängig vom Query-Key persistiert – es gibt
      // ohnehin nur wenige Schreibvorgänge in der App, das lohnt keine
      // eigene Filterung nach mutationKey.
    },
  });

  // Beim (Wieder-)Verbinden alle offline pausierten Mutationen abspielen.
  window.addEventListener("online", () => {
    void queryClient.resumePausedMutations().then(() => {
      void queryClient.invalidateQueries({ queryKey: ["recipes"] });
      void queryClient.invalidateQueries({ queryKey: ["ingredients_master"] });
      void queryClient.invalidateQueries({ queryKey: ["meal-plan"] });
    });
  });

  return restored;
}
