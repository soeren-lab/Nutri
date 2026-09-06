import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useGoalsForm } from "@/components/goals/useGoalsForm";
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  GOAL_RATE_LABELS,
  SEX_LABELS,
  type ActivityLevel,
  type Goal,
  type GoalRate,
  type Sex,
} from "@/lib/nutritionTargets";

/** Körperdaten, Aktivitätslevel und Ziel. */
export function BodyDataPanel() {
  const { form, set, mutation, isLoading } = useGoalsForm();

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
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="weight">Gewicht (kg)</Label>
            <Input
              id="weight"
              inputMode="decimal"
              value={form.weight_kg}
              onChange={(e) => set("weight_kg", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="height">Größe (cm)</Label>
            <Input
              id="height"
              inputMode="decimal"
              value={form.height_cm}
              onChange={(e) => set("height_cm", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="age">Alter</Label>
            <Input
              id="age"
              inputMode="numeric"
              value={form.age}
              onChange={(e) => set("age", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Geschlecht</Label>
          <Select value={form.sex} onValueChange={(v) => v && set("sex", v as Sex)}>
            <SelectTrigger>
              <SelectValue>{SEX_LABELS[form.sex]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SEX_LABELS) as Sex[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SEX_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Aktivitätslevel</Label>
          <Select
            value={form.activity_level}
            onValueChange={(v) => v && set("activity_level", v as ActivityLevel)}
          >
            <SelectTrigger>
              <SelectValue>{ACTIVITY_LABELS[form.activity_level]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTIVITY_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Ziel</Label>
            <Select value={form.goal} onValueChange={(v) => v && set("goal", v as Goal)}>
              <SelectTrigger>
                <SelectValue>{GOAL_LABELS[form.goal]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
                  <SelectItem key={g} value={g}>
                    {GOAL_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.goal !== "maintain" && (
            <div className="space-y-1.5">
              <Label>Tempo</Label>
              <Select
                value={form.goal_rate}
                onValueChange={(v) => v && set("goal_rate", v as GoalRate)}
              >
                <SelectTrigger>
                  <SelectValue>{GOAL_RATE_LABELS[form.goal_rate]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(GOAL_RATE_LABELS) as GoalRate[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {GOAL_RATE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        Speichern
      </Button>
    </form>
  );
}
