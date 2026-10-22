import { onlineManager } from "@tanstack/react-query";

/**
 * "Online" heißt in dieser App: die NAS-API antwortet. Die Internetverbindung von Android allein
 * reicht nicht – unterwegs mit Mobilfunk, aber ohne Tailscale ist Android "online", die NAS aber
 * nicht erreichbar. Dann müssen Änderungen vorgemerkt statt sofort gesendet werden (sonst gehen
 * sie verloren) und Abfragen dürfen pausieren, statt mit Fehlern zu scheitern.
 *
 * Zusammengesetzt aus:
 *  - OS-Status (Network-Plugin bzw. Browser, siehe native-network.ts)
 *  - API-Status: jede Antwort der API setzt ihn auf "erreichbar", ein Netzfehler auf "nicht
 *    erreichbar"; danach wird alle paar Sekunden geprüft, ob die NAS wieder antwortet.
 * Das Ergebnis geht an TanStack Querys `onlineManager`: der pausiert damit Mutationen und
 * Abfragen und spielt sie ab, sobald es wieder "online" ist.
 */

const PROBE_INTERVAL_MS = 5000;

let osOnline = true;
let apiUp = true;
let probeFn: (() => Promise<boolean>) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let probing = false;

function apply() {
  onlineManager.setOnline(osOnline && apiUp);
}

/** Verhindert, dass der onlineManager auf eigene window-Events hört und unseren Status überschreibt. */
export function takeOverOnlineManager() {
  onlineManager.setEventListener(() => () => {});
}

export function isApiUp(): boolean {
  return apiUp;
}

/** Die Prüfung, ob die NAS antwortet (kommt aus db-client, vermeidet einen Import-Zirkel). */
export function setApiProbe(fn: () => Promise<boolean>) {
  probeFn = fn;
}

async function probeOnce(): Promise<void> {
  if (probing || !probeFn) return;
  probing = true;
  try {
    if (await probeFn()) markApiUp(true);
  } finally {
    probing = false;
  }
}

/** Sofort noch einmal nachsehen (Knopf "Erneut prüfen"). */
export function recheckApi(): Promise<void> {
  return probeOnce();
}

export function markApiUp(up: boolean) {
  if (apiUp === up) return;
  apiUp = up;
  apply();
  if (typeof window === "undefined") return;
  if (up) {
    if (timer) clearInterval(timer);
    timer = null;
  } else if (!timer) {
    timer = setInterval(() => void probeOnce(), PROBE_INTERVAL_MS);
  }
}

export function setOsOnline(online: boolean) {
  const regained = online && !osOnline;
  osOnline = online;
  apply();
  // Netz ist (wieder) da: gleich prüfen, ob die NAS erreichbar ist, statt auf den Takt zu warten.
  if (regained && !apiUp) void probeOnce();
}
