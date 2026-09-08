import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

type SwipeHandlers = { onSwipeLeft: () => void; onSwipeRight: () => void };
type Box = { handlers: SwipeHandlers };
type Registry = { stack: Box[] };

const SwipeRegistryContext = createContext<Registry | null>(null);

/**
 * Muss die Tab-Bar-Swipe-Navigation im Authenticated-Shell umschließen.
 * Verwaltet einen Stack: der zuletzt aktiv gewordene Screen/Dialog (z.B. ein
 * Auswahl-Sheet über dem Planer) hat Vorrang; wird er geschlossen, greift
 * automatisch wieder die darunterliegende Ebene.
 */
export function SwipeRegistryProvider({ children }: { children: ReactNode }) {
  const registryRef = useRef<Registry>({ stack: [] });
  return (
    <SwipeRegistryContext.Provider value={registryRef.current}>
      {children}
    </SwipeRegistryContext.Provider>
  );
}

export function useSwipeRegistry(): Registry | null {
  return useContext(SwipeRegistryContext);
}

/** Liest die aktuell zuständigen Handler (oberste Ebene des Stacks), falls vorhanden. */
export function topSwipeHandlers(registry: Registry | null): SwipeHandlers | null {
  if (!registry || registry.stack.length === 0) return null;
  return registry.stack[registry.stack.length - 1]!.handlers;
}

/**
 * Screens/Dialoge mit eigener Unter-Navigation (Tabs, Tages-Auswahl,
 * Formulare zum Schließen) rufen dies auf, um Swipe-Gesten für sich zu
 * beanspruchen. `null` bedeutet "gerade nicht aktiv" (z.B. Dialog zu) – die
 * Stack-Position wird erst beim Wechsel aktiv/inaktiv oder beim Unmount neu
 * bewertet, NICHT bei jeder Re-Render, damit gleichzeitig aktive Ebenen
 * (z.B. Planer im Hintergrund + Auswahl-Sheet obenauf) sich nicht
 * gegenseitig verdrängen.
 */
export function useSwipePriority(handlers: SwipeHandlers | null) {
  const registry = useSwipeRegistry();
  const boxRef = useRef<Box>({
    handlers: handlers ?? { onSwipeLeft: () => {}, onSwipeRight: () => {} },
  });
  if (handlers) boxRef.current.handlers = handlers;
  const active = handlers != null;

  useEffect(() => {
    if (!registry || !active) return;
    const box = boxRef.current;
    registry.stack.push(box);
    return () => {
      const idx = registry.stack.indexOf(box);
      if (idx !== -1) registry.stack.splice(idx, 1);
    };
  }, [registry, active]);
}
