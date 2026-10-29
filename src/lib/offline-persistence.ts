import { get, set, del } from "idb-keyval";
import { persistQueryClient, persistQueryClientSave } from "@tanstack/query-persist-client-core";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { onlineManager, type Query, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { markApiUp } from "@/lib/api-reachability";
import { probeApi } from "@/lib/db-client";
import { warmOfflineCache } from "@/lib/offline-sync";

/**
 * Lokal (IndexedDB) gesichert wird ALLES, was die App geladen hat – Rezepte, Zutaten, Planer
 * (inkl. früherer Wochen), Einkaufsliste, Profil, Ziele, Fortschritt, Gewicht, Teller usw. –, damit
 * die App ohne Verbindung zur NAS vollständig nutzbar bleibt und nach einem Neustart sofort den
 * letzten bekannten Stand zeigt. Ausgenommen sind nur Dinge, die ohne Verbindung keinen Sinn haben
 * oder sich ständig ändern (Suche in Open Food Facts, Community-Inhalte).
 * Auch Seiten mit useSuspenseQuery (z. B. Rezept-Detail) brauchen die Daten lokal, sonst hängen sie
 * offline unauflösbar fest.
 */
const OFFLINE_EXCLUDED_PREFIXES: QueryKey[] = [
  ["off-search"],
  ["community-recipes"],
  ["community-ingredients"],
  ["user-search"],
];

function isOfflineScoped(queryKey: QueryKey): boolean {
  return !OFFLINE_EXCLUDED_PREFIXES.some((prefix) =>
    prefix.every((part, i) => queryKey[i] === part),
  );
}

/** Nach dem Wiedererreichen der NAS neu laden, was offline gesichert wurde (nicht Community & Co.). */
const SYNC_AFTER_RECONNECT_PREFIXES: QueryKey[] = [
  ["recipes"],
  ["ingredients_master"],
  ["meal-plan"],
  ["batch-cook-week"],
  ["shopping-list"],
  ["fridge"],
  ["water"],
  ["user-profile"],
  ["target-history"],
  ["user-plates"],
  ["quick-entry-templates"],
  ["body-measurements"],
  ["user-points"],
  ["credits-balance"],
];

/**
 * Richtet Offline-Persistenz für die oben gelisteten Bereiche ein:
 * - Erfolgreiche Query-Ergebnisse landen in IndexedDB und werden beim
 *   nächsten App-Start sofort angezeigt, auch ganz ohne Netzwerk.
 * - Pausierte (offline ausgelöste) Mutationen überleben ebenfalls einen
 *   App-Neustart und werden automatisch gesendet, sobald wieder online.
 */
export function setupOfflinePersistence(queryClient: QueryClient): Promise<void> {
  const storage = { getItem: get, setItem: set, removeItem: del };
  const persister = createAsyncStoragePersister({ key: "nutri-offline-cache", storage });
  // Zweiter Persister auf demselben Schlüssel, aber ohne Drosselung: für sofortiges Sichern, wenn
  // keine Zeit bleibt (siehe flushNow).
  const flushPersister = createAsyncStoragePersister({
    key: "nutri-offline-cache",
    storage,
    throttleTime: 0,
  });

  const dehydrateOptions = {
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
  };

  // persistQueryClient gibt [unsubscribe, restorePromise] zurück. Der Aufrufer
  // (getRouter in router.tsx) wartet auf das Promise, BEVOR die App rendert –
  // sonst fragen die ersten useQuery-Aufrufe die Query-Keys ab, bevor der
  // IndexedDB-Restore (asynchron) überhaupt fertig ist, und starten offline
  // einen Fetch ins Leere statt die bereits vorhandenen Daten zu zeigen.
  const [, restored] = persistQueryClient({
    queryClient,
    persister,
    // Kein Ablauf: bei einer 30-Tage-Grenze hätte ein Nutzer, der die App
    // wochenlang nicht öffnet, beim nächsten Start den kompletten Offline-
    // Cache verloren – genau der Fall, den Offline-Verfügbarkeit eigentlich
    // abdecken soll. Der Server bleibt ohnehin die Quelle der Wahrheit und
    // synchronisiert automatisch, sobald wieder online (warmOfflineCache).
    maxAge: Infinity,
    dehydrateOptions,
  });

  // Der normale Persister schreibt gedrosselt (bis zu 1 s verzögert). Eine offline vorgemerkte
  // Änderung darf nicht davon abhängen: Wird die App direkt danach geschlossen, gesperrt oder von
  // Android im Hintergrund eingefroren/beendet, wäre sie sonst verloren. Deshalb sofort sichern,
  // sobald eine Änderung pausiert wird, und wenn die App in den Hintergrund geht.
  let restoredDone = false;
  void restored.then(() => {
    restoredDone = true;
  });
  function flushNow() {
    if (!restoredDone) return; // nie vor der Wiederherstellung schreiben (sonst wäre der Cache leer)
    void persistQueryClientSave({ queryClient, persister: flushPersister, dehydrateOptions }).catch(
      (err) => console.warn("[Offline] Sofort-Sichern fehlgeschlagen", err),
    );
  }
  queryClient.getMutationCache().subscribe((event) => {
    if (event.type === "updated" && event.mutation.state.isPaused) flushNow();
  });
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushNow();
    });
    window.addEventListener("pagehide", flushNow);
  }

  function syncOfflineDomain() {
    for (const prefix of SYNC_AFTER_RECONNECT_PREFIXES) {
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
    void warmOfflineCache(queryClient).catch((err) => {
      console.warn("[Offline-Sync] warmOfflineCache abgebrochen", err);
    });
  }

  void restored.then(async () => {
    // Beim Start prüfen, ob die NAS überhaupt antwortet – sonst würden Abfragen und Änderungen erst
    // nach dem ersten Fehlschlag pausiert.
    if (onlineManager.isOnline() && !(await probeApi())) markApiUp(false);
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
