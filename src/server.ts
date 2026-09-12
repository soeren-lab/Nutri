import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { registerPushToken, broadcastAppUpdate } from "./lib/push-notifications.functions";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

const SERVER_FN_PREFIX = "/_serverFn/";

/**
 * Server-Function-Pfade, die die native App auch per POST cross-origin
 * erreichen darf (Pfade sind build-generierte Hashes, deshalb zur Laufzeit
 * aus den echten Function-Objekten gelesen statt von Hand eingetragen).
 * Beide bleiben durch requireSupabaseAuth abgesichert, broadcastAppUpdate
 * zusätzlich durch einen serverseitigen has_role-Check – CORS ist hier nur
 * Erreichbarkeit, nicht die Sicherheitsgrenze.
 */
const NATIVE_CORS_POST_PATHS = new Set([registerPushToken, broadcastAppUpdate].map((fn) => fn.url));

/**
 * Die Capacitor-App hat kein `server.url` (siehe capacitor.config.ts) und ruft
 * Server-Functions deshalb über die absolute Worker-URL auf (cross-origin,
 * siehe openfoodfacts.ts) statt relativ. Damit der Browser/WebView die
 * Antwort lesen darf, brauchen diese Aufrufe CORS-Header.
 *
 * Standardmäßig nur GET freigegeben: die meisten mutierenden Server-Functions
 * in diesem Projekt sind POST + per requireSupabaseAuth serverseitig
 * abgesichert (Konto löschen, PDF-Export, Kochbuch beitreten) und bleiben
 * von dieser Freigabe unberührt – nur die unauthentifizierten GET-Functions
 * (OFF-Suche, Kochbuch-Freigabelink) sowie die zwei in
 * NATIVE_CORS_POST_PATHS gelisteten POST-Functions (Push-Registrierung,
 * Update-Broadcast – der Admin löst Letzteres realistisch vom eigenen
 * Sideload-Handy aus) werden cross-origin erreichbar.
 */
function corsHeaders(request: Request, pathname: string): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set(
    "Access-Control-Allow-Methods",
    NATIVE_CORS_POST_PATHS.has(pathname) ? "GET, POST" : "GET",
  );
  // "authorization" ist nötig, weil attachSupabaseAuth (src/start.ts) den
  // Bearer-Token global an JEDE Server-Function anhängt, auch an diese
  // unauthentifizierten GET-Functions – der Header wird hier nur durchgelassen,
  // nicht ausgewertet (kein requireSupabaseAuth-Middleware auf diesen Routen).
  headers.set(
    "Access-Control-Allow-Headers",
    "x-tsr-serverFn, accept, content-type, authorization",
  );
  headers.set("Access-Control-Max-Age", "86400");
  // TanStack Starts Client prüft response.headers.get("x-tss-serialized")
  // (und "x-tss-raw"), um zu entscheiden, ob der Body per seroval
  // deserialisiert werden muss. Nur CORS-safelistete Header (u. a.
  // content-type) sind bei Cross-Origin-Antworten für JS lesbar – ohne
  // dieses Expose bleibt "x-tss-serialized" für die App unsichtbar, die
  // Deserialisierung wird übersprungen und der Aufruf liefert am Ende
  // `undefined` statt der echten Daten (beobachtet: Response/Body kommen
  // einwandfrei an, aber searchOffProducts() löst zu undefined auf).
  headers.set("Access-Control-Expose-Headers", "x-tss-serialized, x-tss-raw");
  return headers;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const { pathname } = new URL(request.url);
    const isServerFnPath = pathname.startsWith(SERVER_FN_PREFIX);
    const isCorsEligible =
      isServerFnPath &&
      (request.method === "GET" ||
        (request.method === "POST" && NATIVE_CORS_POST_PATHS.has(pathname)));

    if (request.method === "OPTIONS" && isServerFnPath) {
      return new Response(null, { status: 204, headers: corsHeaders(request, pathname) });
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      if (isCorsEligible) {
        const withCors = new Response(normalized.body, {
          status: normalized.status,
          statusText: normalized.statusText,
          headers: normalized.headers,
        });
        corsHeaders(request, pathname).forEach((value, key) => withCors.headers.set(key, value));
        return withCors;
      }
      return normalized;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
