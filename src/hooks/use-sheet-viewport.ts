import { useEffect, useState } from "react";

/**
 * Höhe eines Sheets an den *visuellen* Viewport binden (Mobile).
 * Grund: bei offener Tastatur schrumpft 100dvh auf iOS/Android nicht,
 * Inhalte (Buttons, Listen) liegen dann unter der Tastatur.
 * Auf >= sm (Dialog-Darstellung) wird keine Inline-Höhe gesetzt.
 */
export function useVisualViewportHeight(open: boolean) {
  const [style, setStyle] = useState<{
    height?: string;
    maxHeight?: string;
    top?: string;
  }>({});

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const vv = window.visualViewport;

    const update = () => {
      const isMobile = window.innerWidth < 640;
      if (!isMobile || !vv) {
        setStyle({});
        return;
      }
      const h = `${Math.round(vv.height)}px`;
      setStyle({ height: h, maxHeight: h, top: `${Math.round(vv.offsetTop)}px` });
    };

    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("scroll", update);
    };
  }, [open]);

  return style;
}

/** Body-Scroll sperren, solange das Sheet offen ist. */
export function useBodyScrollLock(open: boolean) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);
}
