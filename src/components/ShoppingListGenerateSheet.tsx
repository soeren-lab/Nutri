import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { FormSheet } from "@/components/FormSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { addDays, startOfWeek, toISODate } from "@/lib/meal-plan";
import { generateShoppingList, type ShoppingRangePreset } from "@/lib/shopping-list";
import { cn } from "@/lib/utils";

const PRESETS: Array<{ id: ShoppingRangePreset; label: string; hint: string }> = [
  { id: "week", label: "Diese Woche", hint: "Mo – So der aktuellen Woche" },
  { id: "next3", label: "Nächste 3 Tage", hint: "Ab heute" },
  { id: "custom", label: "Benutzerdefiniert", hint: "Zeitraum selbst wählen" },
];

/** Bottom-Sheet: Zeitraum wählen und Einkaufsliste aus dem Planer erzeugen. */
export function ShoppingListGenerateSheet({
  open,
  onOpenChange,
  weekStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStart: Date;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [preset, setPreset] = useState<ShoppingRangePreset>("week");
  const [from, setFrom] = useState(toISODate(new Date()));
  const [to, setTo] = useState(toISODate(addDays(new Date(), 6)));
  const [busy, setBusy] = useState(false);

  function range(): [Date, Date] {
    if (preset === "week") return [startOfWeek(weekStart), addDays(startOfWeek(weekStart), 6)];
    if (preset === "next3") return [new Date(), addDays(new Date(), 2)];
    return [new Date(`${from}T00:00:00`), new Date(`${to}T00:00:00`)];
  }

  async function submit() {
    if (!user) return;
    const [a, b] = range();
    if (a > b) {
      toast.error("Das Startdatum liegt nach dem Enddatum");
      return;
    }
    setBusy(true);
    try {
      const count = await generateShoppingList(user.id, a, b);
      await qc.invalidateQueries({ queryKey: ["shopping-list"] });
      if (count === 0) {
        toast.info("Keine Zutaten im gewählten Zeitraum gefunden");
      } else {
        toast.success(`${count} Zutaten übernommen`);
        onOpenChange(false);
        void navigate({ to: "/shopping-list" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Erstellen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Einkaufsliste erstellen"
      footer={
        <Button className="w-full" onClick={() => void submit()} disabled={busy || !user}>
          {busy ? "Erstelle …" : "Liste erstellen"}
        </Button>
      }
    >
      <div className="space-y-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={cn(
              "w-full rounded-xl border px-4 py-3 text-left transition-colors",
              preset === p.id
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40",
            )}
          >
            <span className="block text-sm font-semibold">{p.label}</span>
            <span className="block text-xs text-muted-foreground">{p.hint}</span>
          </button>
        ))}

        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <Label htmlFor="sl-from" className="text-xs">
                Von
              </Label>
              <Input
                id="sl-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sl-to" className="text-xs">
                Bis
              </Label>
              <Input id="sl-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}

        <p className="pt-2 text-xs text-muted-foreground">
          Schnelleinträge werden übersprungen. Bereits vorhandene Einträge werden
          zusammengeführt.
        </p>
      </div>
    </FormSheet>
  );
}
