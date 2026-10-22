import { Network } from "@capacitor/network";
import { isNativeApp } from "@/lib/platform";
import { setOsOnline, takeOverOnlineManager } from "@/lib/api-reachability";

/**
 * Liefert den Netzwerkstatus des Betriebssystems an api-reachability.ts (dort wird er mit der
 * Erreichbarkeit der NAS zum "online"-Status der App kombiniert).
 *
 * `navigator.onLine` und die window-Events sind in der Android-WebView unzuverlässig; nativ
 * kommt der Status deshalb aus dem Network-Plugin.
 */
export async function setupNativeNetworkDetection(): Promise<void> {
  takeOverOnlineManager();

  if (isNativeApp()) {
    const initial = await Network.getStatus();
    setOsOnline(initial.connected);
    void Network.addListener("networkStatusChange", (status) => setOsOnline(status.connected));
    return;
  }

  setOsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
  window.addEventListener("online", () => setOsOnline(true));
  window.addEventListener("offline", () => setOsOnline(false));
}
