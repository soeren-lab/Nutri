import { useEffect, useRef } from "react";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (t: string, cb: () => void) => void;
}

export function useWakeLock(active: boolean) {
  const ref = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function request() {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<WakeLockSentinelLike> } }).wakeLock;
        if (!wl?.request) return;
        const sentinel = await wl.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        ref.current = sentinel;
        sentinel.addEventListener("release", () => {
          ref.current = null;
        });
      } catch {
        // ignore – not supported or denied
      }
    }

    request();

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !ref.current) request();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      ref.current?.release().catch(() => {});
      ref.current = null;
    };
  }, [active]);
}
