import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useNutritionStats } from "@/hooks/use-nutrition-stats";
import { addDays, formatDayShort, startOfWeek, toISODate } from "@/lib/meal-plan";
import { getColorForProgress } from "@/lib/nutritionScore";
import { useTracking } from "@/hooks/use-tracking";
import { cn } from "@/lib/utils";

type Range = { start: Date; end: Date };

function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

const QUICK_RANGES: { label: string; get: () => Range }[] = [
  {
    label: "Diese Woche",
    get: () => {
      const s = startOfWeek(today());
      return { start: s, end: addDays(s, 6) };
    },
  },
  {
    label: "Letzte 7 Tage",
    get: () => ({ start: addDays(today(), -6), end: today() }),
  },
  {
    label: "Dieser Monat",
    get: () => {
      const n = today();
      return {
        start: new Date(n.getFullYear(), n.getMonth(), 1),
        end: new Date(n.getFullYear(), n.getMonth() + 1, 0),
      };
    },
  },
];

const macroConfig = {
  protein_g: { label: "Protein", color: "var(--primary)" },
  carbs_g: { label: "Kohlenhydrate", color: "var(--accent)" },
  fat_g: { label: "Fett", color: "var(--muted-foreground)" },
  fiber_g: { label: "Ballaststoffe", color: "var(--chart-2, #10b981)" },
  targetProtein: { label: "Ziel Protein", color: "var(--foreground)" },
} satisfies ChartConfig;

const kcalConfig = {
  calories: { label: "kcal", color: "var(--primary)" },
  targetCalories: { label: "Ziel", color: "var(--foreground)" },
} satisfies ChartConfig;


/** Wochen-/Zeitraum-Statistik als Sektion im Profil-Fortschritt. */
export function StatsSection({ className }: { className?: string }) {
  const [range, setRange] = useState<Range>(() => QUICK_RANGES[0]!.get());

  return (
    <section
      className={cn("space-y-4 rounded-2xl border border-border bg-card p-4", className)}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <BarChart3 className="h-4 w-4 text-primary" />
        Ernährungs-Statistik
      </h2>
      <RangePicker range={range} onChange={setRange} />
      <StatsContent range={range} />
    </section>
  );
}

function RangePicker({
  range,
  onChange,
}: {
  range: Range;
  onChange: (r: Range) => void;
}) {
  const activeQuick = useMemo(() => {
    return QUICK_RANGES.find((q) => {
      const r = q.get();
      return toISODate(r.start) === toISODate(range.start) &&
        toISODate(r.end) === toISODate(range.end);
    })?.label;
  }, [range]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {QUICK_RANGES.map((q) => (
          <Button
            key={q.label}
            type="button"
            size="sm"
            variant={activeQuick === q.label ? "default" : "outline"}
            className="h-7 rounded-full px-3 text-xs"
            onClick={() => onChange(q.get())}
          >
            {q.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <DateButton
          value={range.start}
          onChange={(d) => onChange({ start: d, end: d > range.end ? d : range.end })}
        />
        <span className="text-xs text-muted-foreground">bis</span>
        <DateButton
          value={range.end}
          onChange={(d) =>
            onChange({ start: d < range.start ? d : range.start, end: d })
          }
        />
      </div>
    </div>
  );
}

function DateButton({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 flex-1 justify-start text-xs">
          <CalendarIcon className="mr-1 h-3.5 w-3.5" />
          {formatDayShort(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            if (d) {
              onChange(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
              setOpen(false);
            }
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function StatsContent({ range }: { range: Range }) {
  const { tracking } = useTracking();
  const hasMacroChart =
    tracking.protein_g || tracking.carbs_g || tracking.fat_g || tracking.fiber_g;
  const { days, averages, hitRate, topItems, avgTargets, isLoading } = useNutritionStats(
    range.start,
    range.end,
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {hitRate ? (
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-2xl font-bold">
            {hitRate.hits} von {hitRate.total}
          </p>
          <p className="text-xs text-muted-foreground">
            Tagen im Zielkorridor (80–110 %)
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Lege im Profil Ziel-Werte fest, um die Trefferquote zu sehen.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <AvgTile label="Ø kcal" value={averages.calories} target={avgTargets.calories} />
        {tracking.protein_g && (
          <AvgTile
            label="Ø P"
            value={averages.protein_g}
            target={avgTargets.protein_g}
            unit="g"
          />
        )}
        {tracking.carbs_g && (
          <AvgTile
            label="Ø KH"
            value={averages.carbs_g}
            target={avgTargets.carbs_g}
            unit="g"
          />
        )}
        {tracking.fat_g && (
          <AvgTile label="Ø F" value={averages.fat_g} target={avgTargets.fat_g} unit="g" />
        )}
        {tracking.fiber_g && (
          <AvgTile
            label="Ø BS"
            value={averages.fiber_g}
            target={avgTargets.fiber_g}
            unit="g"
          />
        )}
        {tracking.sugar_g && (
          <SugarAvgTile
            value={averages.sugar_g ?? 0}
            max={avgTargets.sugar_max_g}
          />
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">Kalorien-Verlauf</p>
        <ChartContainer config={kcalConfig} className="h-44 w-full">
          <ComposedChart data={days} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.3} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
            <YAxis tickLine={false} axisLine={false} fontSize={10} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="calories" fill="var(--color-calories)" radius={3} />
            <Line
              type="stepAfter"
              dataKey="targetCalories"
              stroke="var(--color-targetCalories)"
              strokeDasharray="4 4"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ChartContainer>
      </div>

      {hasMacroChart && (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">
          Makro-Verlauf (gestapelt, g)
        </p>
        <ChartContainer config={macroConfig} className="h-44 w-full">
          <ComposedChart data={days} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.3} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
            <YAxis tickLine={false} axisLine={false} fontSize={10} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {tracking.protein_g && (
              <Bar dataKey="protein_g" stackId="m" fill="var(--color-protein_g)" />
            )}
            {tracking.carbs_g && (
              <Bar dataKey="carbs_g" stackId="m" fill="var(--color-carbs_g)" />
            )}
            {tracking.fat_g && (
              <Bar dataKey="fat_g" stackId="m" fill="var(--color-fat_g)" />
            )}
            {tracking.fiber_g && (
              <Bar
                dataKey="fiber_g"
                stackId="m"
                fill="var(--color-fiber_g)"
                radius={[3, 3, 0, 0]}
              />
            )}
            {tracking.protein_g && (
              <Line
                type="stepAfter"
                dataKey="targetProtein"
                stroke="var(--color-targetProtein)"
                strokeDasharray="4 4"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
          </ComposedChart>
        </ChartContainer>
      </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">
          Häufigste Einträge
        </p>
        {topItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Keine Einträge im Zeitraum.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {topItems.map((t) => (
              <li
                key={t.name}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
              >
                <span className="truncate">{t.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t.count}×
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AvgTile({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target?: number | null;
  unit?: string;
}) {
  return (
    <div className="rounded-lg border border-border px-2 py-1.5 text-center">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      <p
        className="text-sm font-semibold"
        style={{ color: getColorForProgress(value, target ?? null) }}
      >
        {value}
        {unit ?? ""}
      </p>
    </div>
  );
}

/**
 * Ø-Zucker: umgekehrte Logik – Warnfarbe, wenn der Durchschnitt über der
 * eingestellten Obergrenze liegt. Kein Punkte-Bezug.
 */
function SugarAvgTile({ value, max }: { value: number; max?: number | null }) {
  const over = !!max && value > max;
  return (
    <div className="rounded-lg border border-border px-2 py-1.5 text-center">
      <p className="text-[10px] font-bold text-muted-foreground">Ø Zucker</p>
      <p
        className="text-sm font-semibold"
        style={over ? { color: "hsl(38, 92%, 45%)" } : undefined}
      >
        {value}g
      </p>
      {max ? <p className="text-[9px] text-muted-foreground">max {max}g</p> : null}
    </div>
  );
}

export type { Range as StatsRange };
