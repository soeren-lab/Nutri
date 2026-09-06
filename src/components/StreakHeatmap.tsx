import { WEEKDAYS } from "@/lib/meal-plan";
import type { ProgressDay } from "@/lib/progress";
import { cn } from "@/lib/utils";

/**
 * Kalender-Heatmap der letzten Wochen (GitHub-Style):
 * grün = im Zielkorridor, grau = geloggt, leer = nichts geloggt.
 * Die Spaltenzahl wächst mit der vorhandenen Historie (min. 4 Wochen).
 */
export function StreakHeatmap({
  days,
  weeks,
  minWeeks = 4,
  maxWeeks = 12,
}: {
  days: ProgressDay[];
  weeks?: number;
  minWeeks?: number;
  maxWeeks?: number;
}) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const last = days.length > 0 ? new Date(days[days.length - 1]!.date) : new Date();
  // Spalten enden mit der Woche des letzten Tages (Mo–So).
  const weekdayIndex = (last.getDay() + 6) % 7;
  const lastMonday = new Date(last);
  lastMonday.setDate(last.getDate() - weekdayIndex);

  // Dynamisch: nur so viele Wochen wie Historie vorhanden ist (+1 Woche Puffer).
  const firstLogged = days.find((d) => d.hasEntry);
  let auto = minWeeks;
  if (firstLogged) {
    const first = new Date(firstLogged.date);
    const firstWeekdayIndex = (first.getDay() + 6) % 7;
    const firstMonday = new Date(first);
    firstMonday.setDate(first.getDate() - firstWeekdayIndex);
    const spanWeeks =
      Math.round((lastMonday.getTime() - firstMonday.getTime()) / (7 * 86_400_000)) + 1;
    auto = spanWeeks + 1;
  }
  const columnCount = Math.min(maxWeeks, Math.max(minWeeks, weeks ?? auto));

  const columns: (ProgressDay | null)[][] = [];
  for (let w = columnCount - 1; w >= 0; w--) {
    const monday = new Date(lastMonday);
    monday.setDate(lastMonday.getDate() - w * 7);
    const col: (ProgressDay | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      col.push(byDate.get(iso) ?? null);
    }
    columns.push(col);
  }


  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-[1px] text-[9px] text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <span key={w} className="h-4 leading-4">
              {w.slice(0, 2)}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-1">
              {col.map((day, ri) => (
                <span
                  key={ri}
                  title={
                    day
                      ? `${day.date} · ${day.calories} kcal`
                      : "Kein Eintrag"
                  }
                  className={cn(
                    "h-4 w-4 rounded-[4px] border border-border/60",

                    !day || !day.hasEntry
                      ? "bg-muted/30"
                      : day.inTarget
                        ? "border-transparent bg-[hsl(142,70%,40%)]"
                        : "bg-muted-foreground/40",
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <LegendDot className="bg-[hsl(142,70%,40%)]" label="Im Zielkorridor" />
        <LegendDot className="bg-muted-foreground/40" label="Geloggt" />
        <LegendDot className="bg-muted/30" label="Nichts geloggt" />
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("h-3 w-3 rounded-[3px] border border-border/60", className)} />
      {label}
    </span>
  );
}
