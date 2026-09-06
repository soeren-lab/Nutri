import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBodyMeasurements } from "@/hooks/use-body-measurements";
import { toISODate } from "@/lib/meal-plan";
import { todayDate } from "@/lib/progress";

function num(v: string): number | null {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || Number.isNaN(n) ? null : n;
}

/** Formular zum Eintragen von Gewicht, Körperfett, Datum und Notiz. */
export function WeightEntryPanel() {
  const { all, latestWeight, save } = useBodyMeasurements();
  const [date, setDate] = useState(() => toISODate(todayDate()));
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [note, setNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const w = num(weight);
    if (w == null) return;
    save.mutate(
      {
        date,
        weight_kg: w,
        body_fat_percent: num(fat),
        note: note.trim() === "" ? null : note.trim(),
      },
      {
        onSuccess: () => {
          setWeight("");
          setFat("");
          setNote("");
        },
      },
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Neuer Eintrag</h2>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bm-weight">Gewicht (kg)</Label>
            <Input
              id="bm-weight"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bm-fat">KFA (%)</Label>
            <Input
              id="bm-fat"
              inputMode="decimal"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bm-date">Datum</Label>
            <Input
              id="bm-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bm-note">Notiz (optional)</Label>
          <Input
            id="bm-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z. B. morgens, nüchtern"
          />
        </div>
        <Button type="submit" className="w-full" disabled={save.isPending}>
          Eintragen
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        {latestWeight?.weight_kg != null
          ? `Zuletzt: ${Number(latestWeight.weight_kg).toFixed(1).replace(".", ",")} kg am ${latestWeight.date.slice(8, 10)}.${latestWeight.date.slice(5, 7)}. · ${all.length} Einträge insgesamt`
          : "Noch keine Körperwerte – trage dein aktuelles Gewicht ein, um den Verlauf zu starten."}
      </p>
    </section>
  );
}
