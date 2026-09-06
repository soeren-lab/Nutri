import type { ReactNode } from "react";
import { useExperimentalMode } from "@/hooks/use-experimental-mode";

/**
 * Seiten-Header mit Titel/Untertitel/Aktion. Im Experimental-Modus bekommt er
 * dieselbe Glow-Karten-Optik wie der Planer-Hero (Glass-Karte + Blur-Blob
 * hinter dem Titel) – sonst der schlichte Standard-Header.
 */
export function GlassScreenHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  const { enabled } = useExperimentalMode();

  if (!enabled) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-4 shadow-[0_8px_40px_-12px_var(--glow-primary)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
