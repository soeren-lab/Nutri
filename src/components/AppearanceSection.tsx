import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { THEME_LABELS, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: [ThemePreference, typeof Sun][] = [
  ["light", Sun],
  ["dark", Moon],
  ["system", Monitor],
];

/** Darstellung: Hell / Dunkel / System (pro Nutzer gespeichert). */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div>
        <p className="text-sm font-semibold">Darstellung</p>
        <p className="text-xs text-muted-foreground">
          „System“ folgt automatisch der Einstellung deines Geräts.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Darstellung"
        className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-muted/70 p-1 shadow-inner"
      >
        {OPTIONS.map(([value, Icon]) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[13px] font-medium transition-all",
                active
                  ? "text-primary-foreground shadow-md [background:var(--primary-gradient)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {THEME_LABELS[value]}
            </button>
          );
        })}
      </div>
    </section>
  );
}
