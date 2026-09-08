import { useMemo, useState } from "react";
import { Clock, CookingPot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSwipePriority } from "@/hooks/use-swipe-priority";
import {
  batchFormSize,
  fixedBatchServings,
  formsForServings,
  isFixedBatch,
  recipeTotalMinutes,
} from "@/lib/batch";
import { plannedServings, toISODate, type MealPlanEntryFull } from "@/lib/meal-plan";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/**
 * Dialog zum Vorkochen: der Koch-Tag ist frei wählbar, die ausgewählten
 * weiteren Tage werden als „Vorgekocht / Rest" angelegt.
 */
export function BatchPlanDialog({
  entry,
  days,
  initialTargets = [],
  onClose,
  onConfirm,
  onDissolve,
}: {
  entry: MealPlanEntryFull;
  days: Date[];
  /** Bereits verknüpfte weitere Verzehrtage (beim Bearbeiten). */
  initialTargets?: string[];
  onClose: () => void;
  onConfirm: (targetDates: string[], servingsPerDay: number, cookDate: string) => void;
  onDissolve?: () => void;
}) {
  const perDay = plannedServings(entry);
  const editing = !!entry.batch_group_id;
  const [servingsPerDay, setServingsPerDay] = useState(String(perDay));
  const [selected, setSelected] = useState<string[]>(
    initialTargets.filter((d) => d !== entry.date),
  );
  const [cookDate, setCookDate] = useState(entry.batch_cook_date ?? entry.date);

  const recipe = entry.recipe;
  const fixed = isFixedBatch(recipe);
  const formSize = batchFormSize(recipe);
  const totalMinutes = recipeTotalMinutes(recipe);

  const value = Number(servingsPerDay.replace(",", ".")) || 0;
  const totalDays = selected.length + 1;
  const rawTotal = value * totalDays;
  const total = fixed ? fixedBatchServings(rawTotal, formSize) : rawTotal;
  const forms = fixed ? formsForServings(rawTotal, formSize) : null;

  const options = useMemo(
    () => days.map((d) => ({ iso: toISODate(d), label: WEEKDAYS[(d.getDay() + 6) % 7] })),
    [days],
  );

  const toggle = (iso: string) =>
    setSelected((prev) => (prev.includes(iso) ? prev.filter((x) => x !== iso) : [...prev, iso]));

  const eatingDates = [entry.date, ...selected].sort();
  const followUps = eatingDates.filter((d) => d > cookDate).length;

  useSwipePriority({ onSwipeLeft: onClose, onSwipeRight: onClose });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CookingPot className="h-4 w-4 text-primary" />{" "}
            {editing ? "Vorkochen bearbeiten" : "Für mehrere Tage vorkochen"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Wähle den Koch-Tag frei – dort wird die volle Menge eingekauft und zubereitet. Die
          gewählten Verzehrtage werden als vorgekochte Reste geplant.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="batch-cook-date">Koch-Tag</Label>
          <Input
            id="batch-cook-date"
            type="date"
            value={cookDate}
            onChange={(e) => setCookDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Weitere Verzehrtage</Label>
          <div className="flex flex-wrap gap-1.5">
            {options
              .filter((o) => o.iso !== entry.date)
              .map((o) => (
                <button
                  key={o.iso}
                  type="button"
                  onClick={() => toggle(o.iso)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    selected.includes(o.iso)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="batch-servings">Portionen pro Tag</Label>
          <Input
            id="batch-servings"
            inputMode="decimal"
            value={servingsPerDay}
            onChange={(e) => setServingsPerDay(e.target.value)}
          />
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Gesamtmenge: <span className="font-semibold text-foreground">{total} Portionen</span>
            {fixed && forms != null && ` · ${forms} ganze Form(en) à ${formSize} Portionen`}
          </p>
          <p>
            Reicht für <span className="font-semibold text-foreground">{totalDays} Tage</span>
            {followUps > 0 && ` · ${followUps} Folgetag(e) nach dem Koch-Tag`}
          </p>
          {totalMinutes != null && (
            <p className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Gesamtzeit am Koch-Tag: {totalMinutes} Min.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              className="flex-1"
              disabled={selected.length === 0 || value <= 0 || !cookDate}
              onClick={() => onConfirm(selected, value, cookDate)}
            >
              {editing ? "Speichern" : "Verknüpfen"}
            </Button>
          </div>
          {editing && onDissolve && (
            <Button variant="ghost" className="text-destructive" onClick={onDissolve}>
              Verknüpfung komplett löschen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
