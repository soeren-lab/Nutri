import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Droplets, Settings2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSheet } from "@/components/FormSheet";
import { useAuth } from "@/hooks/use-auth";
import { MUTATION_KEYS } from "@/lib/offline-mutations";
import {
  WATER_STEPS_ML,
  formatWater,
  getWaterGoal,
  setWaterGoal,
  totalWaterMl,
  waterQuery,
  type WaterEntry,
} from "@/lib/water";
import { cn } from "@/lib/utils";

/**
 * Wasser-Zähler für einen Tag: Schnelltasten (Glas, Tasse, Flasche), Rückgängig für den letzten
 * Eintrag, Tagesziel einstellbar. Einträge werden wie die Planer-Einträge offline vorgemerkt.
 */
export function WaterCard({ dateIso }: { dateIso: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: entries } = useQuery({ ...waterQuery(dateIso), enabled: !!user });
  const [goal, setGoal] = useState(getWaterGoal);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalText, setGoalText] = useState("");

  const list = entries ?? [];
  const total = totalWaterMl(list);
  const percent = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;
  const reached = total >= goal;
  const last = list[list.length - 1];

  const cacheKey = ["water", dateIso];

  const add = useMutation({
    mutationKey: MUTATION_KEYS.addWater,
    onMutate: (v: { id: string; userId: string; date: string; amountMl: number }) => {
      const entry: WaterEntry = {
        id: v.id,
        user_id: v.userId,
        date: v.date,
        amount_ml: v.amountMl,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<WaterEntry[]>(cacheKey, (old) => [...(old ?? []), entry]);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["water"] }),
    onError: (e: Error) => {
      toast.error(e.message);
      void qc.invalidateQueries({ queryKey: ["water"] });
    },
  });

  const remove = useMutation({
    mutationKey: MUTATION_KEYS.removeWater,
    onMutate: (v: { id: string }) => {
      qc.setQueryData<WaterEntry[]>(cacheKey, (old) => (old ?? []).filter((e) => e.id !== v.id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["water"] }),
    onError: (e: Error) => {
      toast.error(e.message);
      void qc.invalidateQueries({ queryKey: ["water"] });
    },
  });

  function addMl(amountMl: number) {
    if (!user) return;
    add.mutate({ id: crypto.randomUUID(), userId: user.id, date: dateIso, amountMl });
  }

  function saveGoal() {
    const value = Number(goalText.replace(",", "."));
    // Eingaben bis 20 gelten als Liter (2,5), größere als Milliliter (2500).
    const ml = Math.round(value < 20 ? value * 1000 : value);
    if (!Number.isFinite(ml) || ml < 500 || ml > 10_000) {
      toast.error("Bitte ein Ziel zwischen 0,5 und 10 Litern eingeben");
      return;
    }
    setWaterGoal(ml);
    setGoal(ml);
    setGoalOpen(false);
  }

  return (
    <div className="space-y-2.5 rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50 to-cyan-50 p-3 dark:border-sky-300/15 dark:from-sky-950/50 dark:to-slate-900">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-xl bg-white/80 text-sky-600 shadow-sm dark:bg-white/10 dark:text-sky-300",
            reached && "text-emerald-600 dark:text-emerald-300",
          )}
        >
          <Droplets className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-sky-950 dark:text-sky-50">
            Wasser
          </p>
          <p className="text-xs text-sky-900/70 dark:text-sky-100/60">
            {formatWater(total)} von {formatWater(goal)}
            {reached && " · Ziel erreicht"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          aria-label="Wasserziel ändern"
          onClick={() => {
            setGoalText(String(goal / 1000).replace(".", ","));
            setGoalOpen(true);
          }}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <div
        className="h-2.5 overflow-hidden rounded-full bg-white/70 dark:bg-white/10"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Wasser Tagesfortschritt"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            reached ? "bg-emerald-500" : "bg-gradient-to-r from-sky-400 to-cyan-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-1.5">
        {WATER_STEPS_ML.map((ml) => (
          <Button
            key={ml}
            type="button"
            variant="outline"
            disabled={!user}
            onClick={() => addMl(ml)}
            className="h-10 rounded-xl bg-white/70 text-sm font-semibold dark:bg-white/5"
          >
            +{ml}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl"
          disabled={!last}
          aria-label="Letzten Eintrag rückgängig machen"
          onClick={() => last && remove.mutate({ id: last.id })}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
      </div>

      <FormSheet
        open={goalOpen}
        onOpenChange={setGoalOpen}
        title="Wasserziel"
        footer={
          <Button type="button" className="w-full" onClick={saveGoal}>
            Speichern
          </Button>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="water-goal">Tagesziel in Litern</Label>
          <Input
            id="water-goal"
            inputMode="decimal"
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            placeholder="2,5"
          />
          <p className="text-xs text-muted-foreground">
            Das Ziel gilt nur auf diesem Gerät. Üblich sind etwa 2 bis 3 Liter pro Tag.
          </p>
        </div>
      </FormSheet>
    </div>
  );
}
