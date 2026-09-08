import { useEffect, useRef } from "react";

const SWIPE_MIN_DISTANCE = 60;
const SWIPE_MAX_DURATION_MS = 600;
const SWIPE_MAX_VERTICAL_RATIO = 0.5;
const SCROLLABLE_ANCESTOR_MAX_DEPTH = 6;

function startsInsideHorizontalScroller(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  for (let depth = 0; el && depth < SCROLLABLE_ANCESTOR_MAX_DEPTH; depth++, el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflowX = window.getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
  }
  return false;
}

/**
 * Erkennt horizontale Swipe-Gesten app-weit (auf window, nicht nur einem
 * Container) und ruft onSwipeLeft/onSwipeRight auf. Läuft auf window statt
 * einem Ref, damit auch Portal-Inhalte (Dialoge, Sheets – rendern außerhalb
 * des normalen Baums an document.body) Gesten empfangen. Ignoriert Gesten,
 * die auf einem horizontal scrollbaren Element beginnen (z.B.
 * Kategorie-Chips), damit normales Scrollen dort nicht kollidiert.
 */
export function useSwipeNavigation(
  onSwipeLeft: (() => void) | null,
  onSwipeRight: (() => void) | null,
) {
  const start = useRef<{ x: number; y: number; t: number; ignore: boolean } | null>(null);
  const handlers = useRef({ onSwipeLeft, onSwipeRight });
  handlers.current = { onSwipeLeft, onSwipeRight };

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      if (!touch) return;
      start.current = {
        x: touch.clientX,
        y: touch.clientY,
        t: Date.now(),
        ignore: startsInsideHorizontalScroller(e.target),
      };
    }

    function onTouchEnd(e: TouchEvent) {
      const begin = start.current;
      start.current = null;
      if (!begin || begin.ignore) return;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - begin.x;
      const dy = touch.clientY - begin.y;
      const dt = Date.now() - begin.t;
      if (dt > SWIPE_MAX_DURATION_MS) return;
      if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return;
      if (Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_VERTICAL_RATIO) return;

      if (dx < 0) handlers.current.onSwipeLeft?.();
      else handlers.current.onSwipeRight?.();
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);
}
