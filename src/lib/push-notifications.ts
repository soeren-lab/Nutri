import { isNativeApp } from "@/lib/platform";
import { registerPushToken, broadcastAppUpdate } from "@/lib/push-notifications.functions";

// Muss mit PRODUCTION_ORIGIN in openfoodfacts.ts und WORKER_URL in
// scripts/build-capacitor-shell.mjs übereinstimmen.
const PRODUCTION_ORIGIN = "https://tanstack-start-ts.nutriapp.workers.dev";

/** Siehe openfoodfacts.ts: die Capacitor-App hat kein `server.url`, deshalb
 * müssen Server-Function-Aufrufe nativ auf die deployte Worker-URL umgehängt
 * werden. CORS dafür ist in src/server.ts gezielt für diese beiden
 * Functions freigeschaltet. */
function nativeServerFnFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  const absolute = url.startsWith("http") ? url : `${PRODUCTION_ORIGIN}${url}`;
  return fetch(absolute, init);
}

/** Fordert Notification-Erlaubnis an und registriert das Gerät für Push (nur nativ). */
export async function registerForPushNotifications(): Promise<void> {
  if (!isNativeApp()) return;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  await PushNotifications.addListener("registration", (token) => {
    void registerPushToken({
      data: { token: token.value, platform: "android" },
      fetch: nativeServerFnFetch,
    });
  });
  PushNotifications.addListener("registrationError", (err) => {
    console.error("[push] Registrierung fehlgeschlagen", err);
  });

  await PushNotifications.register();
}

/** Löst den Admin-Broadcast ("App aktualisieren" an alle anderen Accounts) aus. */
export function sendUpdateBroadcast() {
  return broadcastAppUpdate(isNativeApp() ? { fetch: nativeServerFnFetch } : {});
}
