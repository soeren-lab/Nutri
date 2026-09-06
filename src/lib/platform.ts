import { Capacitor } from "@capacitor/core";

/**
 * True in der nativen Android-Hülle (Capacitor). Dort läuft aktuell kein
 * eigener Server (`*.functions.ts`-Endpunkte) – anders als in der
 * Web-/PWA-Version, die weiterhin gegen einen echten Server läuft.
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
