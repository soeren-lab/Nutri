import { isNativeApp } from "@/lib/platform";
import { analyzeMealPhoto } from "@/lib/photoScan.functions";
import type { ScanItem, ScanMaster } from "@/lib/photoNutrition";
import type { PlateInfo } from "@/lib/plates";

// Muss mit PRODUCTION_ORIGIN in push-notifications.ts/openfoodfacts.ts und WORKER_URL in
// scripts/build-capacitor-shell.mjs übereinstimmen.
const PRODUCTION_ORIGIN = "https://tanstack-start-ts.nutriapp.workers.dev";

/** Die Capacitor-App hat kein `server.url`: Server-Functions laufen dort cross-origin
 * gegen den deployten Worker (CORS dafür ist in src/server.ts freigeschaltet). */
function nativeServerFnFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  const absolute = url.startsWith("http") ? url : `${PRODUCTION_ORIGIN}${url}`;
  return fetch(absolute, init);
}

export type AnalyzeInput = {
  /** Base64-JPEG ohne data:-Präfix. */
  image?: string;
  refImage?: string;
  note?: string;
  previous?: ScanItem[];
  correction?: string;
  plate?: PlateInfo;
  masters: ScanMaster[];
};

/** Schickt Foto(s)/Korrektur an die KI-Auswertung (Server prüft Max-Plan und Tageslimit). */
export function analyzeMeal(input: AnalyzeInput) {
  const { masters, ...rest } = input;
  return analyzeMealPhoto({
    data: {
      ...rest,
      candidates: masters.slice(0, 400).map((m) => ({
        id: m.id,
        name: m.name.slice(0, 80),
        unit: m.unit,
      })),
    },
    ...(isNativeApp() ? { fetch: nativeServerFnFetch } : {}),
  });
}
