import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useGoalsForm } from "@/components/goals/useGoalsForm";

/** Tagesziele: automatisch berechnet oder eigene Werte. */
export function TargetValuesPanel() {
  const { form, set, manual, setManual, preview, mutation, isLoading } = useGoalsForm();

  if (isLoading) return <LoadingSpinner />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-5"
    >
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Eigene Werte eingeben</p>
            <p className="text-xs text-muted-foreground">Überschreibt die Berechnung</p>
          </div>
          <Switch checked={manual} onCheckedChange={setManual} />
        </div>

        {manual ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tc">Kalorien</Label>
              <Input
                id="tc"
                inputMode="decimal"
                value={form.target_calories}
                onChange={(e) => set("target_calories", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tp">Protein (g)</Label>
              <Input
                id="tp"
                inputMode="decimal"
                value={form.target_protein_g}
                onChange={(e) => set("target_protein_g", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tk">Kohlenhydrate (g)</Label>
              <Input
                id="tk"
                inputMode="decimal"
                value={form.target_carbs_g}
                onChange={(e) => set("target_carbs_g", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tf">Fett (g)</Label>
              <Input
                id="tf"
                inputMode="decimal"
                value={form.target_fat_g}
                onChange={(e) => set("target_fat_g", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tb">Ballaststoffe (g)</Label>
              <Input
                id="tb"
                inputMode="decimal"
                value={form.target_fiber_g}
                onChange={(e) => set("target_fiber_g", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tz">Zucker (g)</Label>
              <Input
                id="tz"
                inputMode="decimal"
                placeholder="50"
                value={form.target_sugar_max_g}
                onChange={(e) => set("target_sugar_max_g", e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Maximalwert, kein Ziel-Korridor
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Basierend auf deinen Angaben (Mifflin-St-Jeor, Protein 2 g/kg, Fett 25 % der
            Kalorien, Ballaststoffe 14 g pro 1000 kcal).
          </p>
        )}
      </section>

      {!manual &&
        (preview ? (
          <section className="space-y-3 rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-accent/5 p-4">
            <p className="text-sm font-semibold">Deine Ziel-Werte</p>
            <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
              <TargetTile label="kcal" value={preview.calories} />
              <TargetTile label="Protein" value={preview.protein_g} suffix="g" />
              <TargetTile label="KH" value={preview.carbs_g} suffix="g" />
              <TargetTile label="Fett" value={preview.fat_g} suffix="g" />
              <TargetTile label="Ballaststoffe" value={preview.fiber_g} suffix="g" />
              <TargetTile label="Zucker max." value={preview.sugar_max_g} suffix="g" />
            </div>
            {preview.tdee > 0 && (
              <p className="text-xs text-muted-foreground">
                Grundumsatz {preview.bmr} kcal · Gesamtumsatz {preview.tdee} kcal
              </p>
            )}
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">
            Fülle Gewicht, Größe und Alter aus, um deine Ziel-Werte zu berechnen.
          </p>
        ))}

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        Speichern
      </Button>
    </form>
  );
}

function TargetTile({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl bg-card px-2 py-2">
      <p className="text-base font-bold tabular-nums">
        {value}
        {suffix}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
