import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";
import { setupOfflinePersistence } from "@/lib/offline-persistence";
import { registerOfflineMutationDefaults } from "@/lib/offline-mutations";
import { setupNativeNetworkDetection } from "@/lib/native-network";

export const getRouter = async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Standard-gcTime (5 Min.) würde offline-relevante Queries (v.a. die
      // vielen einzelnen signierten Bild-URLs) nach Verlassen der Seite aus
      // dem Live-Cache werfen – der nächste beliebige Cache-Schreibvorgang
      // irgendwo in der App überschreibt dann den kompletten IndexedDB-
      // Snapshot OHNE die inzwischen entfernte Query, wodurch bereits
      // gesicherte Daten dauerhaft verloren gehen, lange bevor der Nutzer
      // offline geht. App-weit statt pro Query, damit jede künftige
      // offline-relevante Query automatisch mit abgesichert ist.
      queries: { gcTime: Infinity },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // dehydrateMutation() persistiert nie onError-Closures – eine nach
        // App-Neustart wiederhergestellte Mutation hat also nie ein eigenes
        // onError mehr. Das ist genau der Fall, den wir hier auffangen
        // müssen: reguläre In-App-Fehler haben weiterhin ihr eigenes
        // onError und werden hier absichtlich nicht doppelt gemeldet.
        if (!mutation.options.onError) {
          toast.error(
            error instanceof Error
              ? `Synchronisierung fehlgeschlagen: ${error.message}`
              : "Synchronisierung fehlgeschlagen – bitte erneut versuchen",
          );
        }
      },
    }),
  });

  // Muss VOR der IndexedDB-Wiederherstellung passieren: sonst könnte ein
  // Resume-Versuch direkt nach dem Restore auf einen noch unregistrierten
  // mutationKey treffen.
  registerOfflineMutationDefaults(queryClient);

  // Nur im Browser (nicht während SSR) – IndexedDB gibt es dort nicht.
  // Wichtig: auf die Wiederherstellung warten, BEVOR der Router (und damit
  // die erste Query) startet – sonst laufen die ersten Fetches offline ins
  // Leere, bevor die persistierten Rezepte/Zutaten/Planer-Daten überhaupt
  // aus IndexedDB geladen sind.
  if (typeof window !== "undefined") {
    // Muss vor setupOfflinePersistence laufen: dessen Boot-Resume-Check
    // fragt onlineManager.isOnline() direkt nach der Wiederherstellung ab.
    await setupNativeNetworkDetection();
    await setupOfflinePersistence(queryClient);
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
