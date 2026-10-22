import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Fängt die Android-Zurück-Taste/-Geste ab, solange `active` true ist (nur in der nativen App).
 * Solange der Listener registriert ist, übernimmt `onBack` die Taste komplett – die Standard-
 * Navigation ("zurück" bzw. App schließen) findet dann nicht statt.
 */
export function useAndroidBackGuard(active: boolean, onBack: () => void) {
  const handler = useRef(onBack);
  handler.current = onBack;

  useEffect(() => {
    if (!active || !Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let remove: (() => void) | null = null;
    void import("@capacitor/app").then(async ({ App }) => {
      const sub = await App.addListener("backButton", () => handler.current());
      if (cancelled) void sub.remove();
      else remove = () => void sub.remove();
    });
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [active]);
}
