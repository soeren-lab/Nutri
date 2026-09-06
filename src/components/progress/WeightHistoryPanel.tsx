import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useBodyMeasurements } from "@/hooks/use-body-measurements";
import { addDays, toISODate } from "@/lib/meal-plan";
import { todayDate } from "@/lib/progress";

const RANGES: { label: string; days: number }[] = [
  { label: "30 Tage", days: 30 },
  { label: "90 Tage", days: 90 },
  { label: "1 Jahr", days: 365 },
];

const bodyConfig = {
  weight_kg: { label: "Gewicht (kg)", color: "var(--primary)" },
  body_fat_percent: { label: "Körperfett (%)", color: "var(--accent)" },
} satisfies ChartConfig;

/** Gleichmäßige, gerundete Y-Achsen-Skala mit knappem Padding. */
function niceScale(
  values: number[],
  pad = 0.4,
): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 1], ticks: [0, 1] };
  let min = Math.min(...values) - pad;
  let max = Math.max(...values) + pad;
  if (max - min < 1) {
    const mid = (min + max) / 2;
    min = mid - 0.5;
    max = mid + 0.5;
  }
  const raw = (max - min) / 4;
  const step =
    [0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50].find((s) => s >= raw) ?? 100;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return { domain: [lo, hi], ticks };
}

function dayTs(iso: string): number {
  return new Date(`${iso}T00:00:00`).getTime();
}

function formatTick(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

/** Auswertung der Körperwerte: Kennzahlen, Chart und Verlauf-Liste. */
export function WeightHistoryPanel() {
  const [rangeDays, setRangeDays] = useState(90);
  const range = useMemo(() => {
    const end = todayDate();
    return { start: addDays(end, -(rangeDays - 1)), end };
  }, [rangeDays]);

  const { measurements, all, isLoading, latestWeight, latestBodyFat, trend, remove } =
    useBodyMeasurements(range);

  const chartData = useMemo(
    () =>
      measurements.map((m) => ({
        ts: dayTs(m.date),
        weight_kg: m.weight_kg != null ? Number(m.weight_kg) : null,
        body_fat_percent:
          m.body_fat_percent != null ? Number(m.body_fat_percent) : null,
      })),
    [measurements],
  );

  // X-Achse folgt der TATSÄCHLICHEN Datenspanne (nicht dem Zeitraum-Filter).
  const xDomain = useMemo<[number, number]>(() => {
    if (chartData.length === 0) {
      return [dayTs(toISODate(range.start)), dayTs(toISODate(range.end))];
    }
    const ts = chartData.map((d) => d.ts);
    const min = Math.min(...ts);
    const max = Math.max(...ts);
    const day = 86_400_000;
    if (max === min) return [min - 3 * day, max + 3 * day];
    const pad = Math.max(day, (max - min) * 0.05);
    return [min - pad, max + pad];
  }, [chartData, range.start, range.end]);

  const xTicks = useMemo(() => {
    const [from, to] = xDomain;
    const count = Math.min(5, Math.max(2, chartData.length));
    const step = (to - from) / (count - 1);
    return Array.from({ length: count }, (_, i) => Math.round(from + i * step));
  }, [xDomain, chartData.length]);

  const weightScale = useMemo(
    () =>
      niceScale(
        chartData.map((d) => d.weight_kg).filter((v): v is number => v != null),
        0.4,
      ),
    [chartData],
  );

  const fatScale = useMemo(
    () =>
      niceScale(
        chartData
          .map((d) => d.body_fat_percent)
          .filter((v): v is number => v != null),
        0.4,
      ),
    [chartData],
  );

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Körperwerte</h2>

      {isLoading ? (
        <LoadingSpinner />
      ) : all.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Körperwerte – trage im Ziele-Tab dein aktuelles Gewicht ein, um
          den Verlauf zu starten.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Tile
              label="Gewicht"
              value={
                latestWeight?.weight_kg != null
                  ? `${Number(latestWeight.weight_kg).toFixed(1)} kg`
                  : "–"
              }
            />
            <Tile
              label="Körperfett"
              value={
                latestBodyFat?.body_fat_percent != null
                  ? `${Number(latestBodyFat.body_fat_percent).toFixed(1)} %`
                  : "–"
              }
            />
            <Tile
              label="Trend"
              value={
                trend
                  ? `${trend.delta > 0 ? "+" : ""}${trend.delta.toFixed(1)} kg`
                  : "–"
              }
              hint={trend ? `letzte ${trend.days} Tage` : undefined}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <Button
                key={r.days}
                type="button"
                size="sm"
                variant={rangeDays === r.days ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => setRangeDays(r.days)}
              >
                {r.label}
              </Button>
            ))}
          </div>

          {chartData.length > 0 ? (
            <ChartContainer config={bodyConfig} className="h-48 w-full">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.3} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={xDomain}
                  ticks={xTicks}
                  tickFormatter={formatTick}
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                />
                <YAxis
                  yAxisId="w"
                  domain={weightScale.domain}
                  ticks={weightScale.ticks}
                  width={34}
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                />
                <YAxis yAxisId="f" orientation="right" domain={fatScale.domain} hide />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) =>
                        formatTick(Number(payload?.[0]?.payload?.ts))
                      }
                    />
                  }
                />
                <Line
                  yAxisId="w"
                  type="monotone"
                  dataKey="weight_kg"
                  stroke="var(--color-weight_kg)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-weight_kg)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
                <Line
                  yAxisId="f"
                  type="monotone"
                  dataKey="body_fat_percent"
                  stroke="var(--color-body_fat_percent)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 2.5, fill: "var(--color-body_fat_percent)", strokeWidth: 0 }}
                  connectNulls
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <p className="text-xs text-muted-foreground">
              Keine Einträge im gewählten Zeitraum.
            </p>
          )}

          <MeasurementList
            items={[...all].reverse().slice(0, 5)}
            onDelete={(id) => remove.mutate(id)}
          />

          {all.length > 5 ? (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  Alle Einträge anzeigen ({all.length})
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                <SheetHeader className="text-left">
                  <SheetTitle>Alle Körperwerte</SheetTitle>
                </SheetHeader>
                <div className="pb-6">
                  <MeasurementList
                    items={[...all].reverse()}
                    onDelete={(id) => remove.mutate(id)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          ) : null}
        </>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/40 px-2 py-2">
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type Measurement = ReturnType<typeof useBodyMeasurements>["all"][number];

/** Kompakte Liste von Körperwert-Einträgen mit Löschen-Aktion. */
function MeasurementList({
  items,
  onDelete,
}: {
  items: Measurement[];
  onDelete: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {items.map((m) => (
        <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
          <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
            {m.date.slice(8, 10)}.{m.date.slice(5, 7)}.{m.date.slice(2, 4)}
          </span>
          <span className="font-semibold tabular-nums">
            {m.weight_kg != null ? `${Number(m.weight_kg).toFixed(1)} kg` : "–"}
          </span>
          {m.body_fat_percent != null ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {Number(m.body_fat_percent).toFixed(1)} %
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {m.note ?? ""}
          </span>
          <button
            type="button"
            aria-label="Eintrag löschen"
            onClick={() => onDelete(m.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
