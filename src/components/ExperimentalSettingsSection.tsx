import { AlertTriangle, Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useExperimentalMode } from "@/hooks/use-experimental-mode";

export function ExperimentalSettingsSection() {
  const { enabled, variant, setEnabled, setVariant, isSaving } = useExperimentalMode();

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="experimental-glass" className="text-sm font-semibold">
            Experimental
          </Label>
          <p className="text-xs text-muted-foreground">Neue Glass-Oberfläche für die gesamte App</p>
        </div>
        <Switch
          id="experimental-glass"
          checked={enabled}
          disabled={isSaving}
          onCheckedChange={setEnabled}
        />
      </div>

      {enabled && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Farbvariante</p>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/70 p-1">
            {(
              [
                ["dark", "Dunkel", Moon],
                ["light", "Hell", Sun],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                disabled={isSaving}
                onClick={() => setVariant(value)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all",
                  variant === value
                    ? "text-primary-foreground shadow-md [background:var(--primary-gradient)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-[11px] leading-relaxed text-destructive">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Experimentelles Feature: In diesem Modus können Bugs und unerwartetes Verhalten auftreten.
          Kein bestehendes Feature geht verloren – nur die Optik ändert sich. Bei Problemen einfach
          wieder ausschalten.
        </span>
      </p>
    </section>
  );
}
