import { AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useExperimentalMode } from "@/hooks/use-experimental-mode";

/** Schaltet den experimentellen Glass-Look der App ein/aus (nur Admins). */
export function ExperimentalSettingsSection() {
  const { enabled, setEnabled, isSaving } = useExperimentalMode();

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
