import { Moon, Sun } from "lucide-react";
import { useExperimentalMode } from "@/hooks/use-experimental-mode";
import { GLASS_VARIANT_LABELS } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS = (["light", "dark"] as const).map(
  (value) => [value, value === "light" ? Sun : Moon] as const,
);

/** Darstellung: Liquid Glass ist der Standard-Look, hier nur die Farbvariante wählbar. */
export function LiquidGlassAppearanceSection() {
  const { variant, setVariant, isSaving } = useExperimentalMode();

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div>
        <p className="text-sm font-semibold">Darstellung</p>
        <p className="text-xs text-muted-foreground">Liquid Glass – wähle Hell oder Dunkel.</p>
      </div>
      <div
        role="radiogroup"
        aria-label="Darstellung"
        className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/70 p-1 shadow-inner"
      >
        {OPTIONS.map(([value, Icon]) => {
          const active = variant === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={isSaving}
              onClick={() => setVariant(value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[13px] font-medium transition-all",
                active
                  ? "text-primary-foreground shadow-md [background:var(--primary-gradient)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {GLASS_VARIANT_LABELS[value]}
            </button>
          );
        })}
      </div>
    </section>
  );
}
