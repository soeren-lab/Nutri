import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setupOfflinePersistence } from "@/lib/offline-persistence";

export const getRouter = async () => {
  const queryClient = new QueryClient();

  // Nur im Browser (nicht während SSR) – IndexedDB gibt es dort nicht.
  // Wichtig: auf die Wiederherstellung warten, BEVOR der Router (und damit
  // die erste Query) startet – sonst laufen die ersten Fetches offline ins
  // Leere, bevor die persistierten Rezepte/Zutaten/Planer-Daten überhaupt
  // aus IndexedDB geladen sind.
  if (typeof window !== "undefined") {
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
