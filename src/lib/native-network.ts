import { onlineManager } from "@tanstack/react-query";
import { Network } from "@capacitor/network";
import { isNativeApp } from "@/lib/platform";

/**
 * `navigator.onLine`/die window-online-offline-Events, auf die TanStack
 * Querys onlineManager standardmäßig hört, sind in der Android-WebView
 * unzuverlässig – sie melden teils "online", obwohl gar keine echte
 * Internetverbindung besteht (nur ein Netzwerk-Interface ist aktiv). Dadurch
 * wird ein Fetch bei `networkMode: "online"` nicht sauber pausiert, sondern
 * tatsächlich versucht, schlägt mit einem echten Netzwerkfehler fehl und
 * lässt z. B. `useSuspenseQuery` (Rezept-Detailseite) mit einem harten Fehler
 * abstürzen statt auf bereits vorhandene Daten zurückzufallen.
 *
 * Nativ (Capacitor) ersetzen wir die Quelle daher durch das Network-Plugin,
 * das den echten Verbindungsstatus des Betriebssystems liefert.
 */
export async function setupNativeNetworkDetection(): Promise<void> {
  if (!isNativeApp()) {
    console.warn("[Native-Network] Keine native Plattform, überspringe");
    return;
  }

  const initial = await Network.getStatus();
  console.warn(`[Native-Network] Initialer Status: connected=${initial.connected}`);
  onlineManager.setEventListener((setOnline) => {
    setOnline(initial.connected);
    const handle = Network.addListener("networkStatusChange", (status) => {
      console.warn(`[Native-Network] Statusänderung: connected=${status.connected}`);
      setOnline(status.connected);
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  });
}
