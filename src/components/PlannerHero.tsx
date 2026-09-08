import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatWeekRange, isToday, toISODate, WEEKDAYS } from "@/lib/meal-plan";
import type { MacroTotals } from "@/lib/meal-plan";
import type { NutritionTargets } from "@/lib/nutritionTargets";
import type { TargetsForDate } from "@/lib/targetHistory";
import { cn } from "@/lib/utils";

/** Scroll-Schwellen für den Kompakt-Header. */
const COMPACT_ON = 80;
const COMPACT_OFF = 20;

/**
 * Planner-Hero: Wochennavigation, großer kcal-Fortschrittsring (Lila→Indigo)
 * und Wochentag-Tabs mit Mini-Fortschrittsringen als eine zusammenhängende,
 * gläserne Fläche. Beim Scrollen schrumpft der Block animiert zu einer
 * kompakten, deckenden Sticky-Leiste (Tag + kcal-Fortschritt + Mini-Ring).
 */
export function PlannerHero({
  weekStart,
  days,
  activeDay,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  onToday,
  weekAverageKcal,
  weekTargets,
  targetsFor,
  dayTotals,
  forceCompact = false,
  onOpenAnalysis,
}: {
  weekStart: Date;
  days: Date[];
  activeDay: string;
  onSelectDay: (iso: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  weekAverageKcal: number | null;
  weekTargets: NutritionTargets | null;
  targetsFor: TargetsForDate;
  dayTotals: (day: Date) => MacroTotals | null;
  forceCompact?: boolean;
  onOpenAnalysis: () => void;
}) {
  const [scrolledCompact, setScrolledCompact] = useState(false);
  const compact = forceCompact || scrolledCompact;

  useEffect(() => {
    if (forceCompact) return;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolledCompact((current) => {
        if (current && y < COMPACT_OFF) return false;
        if (!current && y > COMPACT_ON) return true;
        return current;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [forceCompact]);

  // Daten des ausgewählten Tages für die kompakte Zeile.
  const activeDate = new Date(`${activeDay}T00:00:00`);
  const activeTotals = dayTotals(activeDate);
  const activeTargets = targetsFor(activeDay);
  const activeKcal = Math.round(activeTotals?.calories ?? 0);
  const activeTargetKcal = activeTargets?.calories ?? 0;
  const activePercent =
    activeTargetKcal > 0 ? Math.round((activeKcal / activeTargetKcal) * 100) : 0;
  const activeWeekday = WEEKDAYS[(activeDate.getDay() + 6) % 7];
  const activeDateLabel = `${String(activeDate.getDate()).padStart(2, "0")}.${String(
    activeDate.getMonth() + 1,
  ).padStart(2, "0")}.`;

  return (
    <div
      className={cn(
        // "bg-card" bewusst IMMER (auch compact): unter Liquid Glass ist das
        // eine deckende Verlaufsfläche (kein Alpha-Kanal), also weiterhin
        // blickdicht während die Karte sticky über scrollendem Inhalt steht
        // – nur eben im Liquid-Glass-Look statt als reine Flachfarbe.
        // "no-refract" nur compact: der Refraktions-Test (styles.css) macht
        // die Fläche wieder transluzent+geblurt – für eine dauerhaft über
        // scrollendem Inhalt stehende Karte genau der alte Lesbarkeits-Bug.
        "relative overflow-hidden border border-primary/20 bg-card transition-all duration-300 ease-out",
        compact
          ? "no-refract rounded-2xl shadow-[0_4px_24px_-8px_var(--glow-primary)]"
          : "rounded-3xl shadow-[0_8px_40px_-12px_var(--glow-primary)]",
      )}
    >
      {/* Weicher Verlauf + Glow im Hintergrund */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-300",
          compact ? "opacity-[0.08] dark:opacity-[0.14]" : "opacity-[0.14] dark:opacity-[0.22]",
        )}
        style={{ background: "var(--primary-gradient)" }}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-16 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl transition-opacity duration-300",
          compact && "opacity-0",
        )}
      />

      <div
        className={cn(
          "relative px-4 pt-3 transition-all duration-300 ease-out",
          compact ? "space-y-2 pb-2.5" : "space-y-4 pb-4",
        )}
      >
        {/* Wochennavigation */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevWeek}
            aria-label="Vorherige Woche"
            className="h-8 w-8 rounded-full"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold">Woche vom {formatWeekRange(weekStart)}</p>
            <button
              type="button"
              onClick={onToday}
              className={cn(
                "text-xs text-primary hover:underline transition-all duration-300",
                compact && "hidden",
              )}
            >
              Heute
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNextWeek}
            aria-label="Nächste Woche"
            className="h-8 w-8 rounded-full"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenAnalysis}
            aria-label="Tagesanalyse anzeigen"
            className="h-8 w-8 rounded-full"
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>

        {/* Großer zentraler Fortschrittsring – kollabiert sanft beim Scrollen */}
        <div
          className={cn(
            "grid transition-all duration-300 ease-out",
            compact ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
          )}
        >
          <div className="overflow-hidden">
            {weekTargets ? (
              <div className="flex flex-col items-center gap-1.5">
                <GradientRing
                  value={Math.round(weekAverageKcal ?? 0)}
                  target={weekTargets.calories}
                  size={120}
                />
                <p className="text-[11px] text-muted-foreground">
                  Ø pro Tag diese Woche · Ziel {weekTargets.calories} kcal
                </p>
              </div>
            ) : (
              <Link
                to="/profile"
                className="block rounded-xl border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground hover:border-primary/50 hover:text-primary"
              >
                Ziel-Werte im Profil hinterlegen, um deinen Fortschritt zu sehen →
              </Link>
            )}
          </div>
        </div>

        {/* Kompakte Tages-Zeile – blendet beim Scrollen ein */}
        <div
          className={cn(
            "grid transition-all duration-300 ease-out",
            compact ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {activeTargetKcal > 0 && (
                  <CompactRing ratio={Math.max(0, Math.min(1, activeKcal / activeTargetKcal))} />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-tight">
                    {activeWeekday} {activeDateLabel}
                    {isToday(activeDate) && (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Heute
                      </span>
                    )}
                  </p>
                  {activeTargetKcal > 0 ? (
                    <p className="text-[11px] text-muted-foreground tabular-nums leading-tight">
                      {activeKcal}/{activeTargetKcal} kcal · {activePercent}%
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground tabular-nums leading-tight">
                      {activeKcal} kcal
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onToday}
                className="shrink-0 text-xs text-primary hover:underline"
              >
                Heute
              </button>
            </div>
          </div>
        </div>

        {/* Wochentag-Tabs – kompakt: nur Kürzel + Mini-Fortschrittsbalken */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const iso = toISODate(day);
            const active = iso === activeDay;
            const totals = dayTotals(day);
            const t = targetsFor(iso);
            const ratio =
              t && t.calories > 0
                ? Math.max(0, Math.min(1, (totals?.calories ?? 0) / t.calories))
                : 0;
            const hasEntries = (totals?.calories ?? 0) > 0;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onSelectDay(iso)}
                aria-label={`${WEEKDAYS[(day.getDay() + 6) % 7]} ${iso}`}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl transition-all duration-300",
                  compact ? "py-1 rounded-xl" : "py-1.5",
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_4px_16px_-4px_var(--glow-primary-strong)]"
                    : "hover:bg-primary/10",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-wide",
                    !active && isToday(day) && "font-bold text-primary",
                    !active && !isToday(day) && "text-muted-foreground",
                  )}
                >
                  {WEEKDAYS[(day.getDay() + 6) % 7]}
                </span>
                {compact ? (
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-semibold tabular-nums leading-none">
                      {day.getDate()}
                    </span>
                    <span
                      className={cn(
                        "h-0.5 w-4 rounded-full",
                        active ? "bg-primary-foreground/30" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "block h-full rounded-full transition-all",
                          active ? "bg-primary-foreground" : "bg-primary",
                          !hasEntries && "opacity-0",
                        )}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </span>
                  </span>
                ) : (
                  <MiniDayRing
                    ratio={ratio}
                    filled={hasEntries}
                    active={active}
                    label={String(day.getDate())}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Großer Ring mit Lila→Indigo-Verlauf. */
function GradientRing({ value, target, size }: { value: number; target: number; size: number }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
  const percent = target > 0 ? Math.round((value / target) * 100) : 0;
  const over = target > 0 && value > target * 1.1;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="planner-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted/60"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={over ? "var(--status-warn)" : "url(#planner-ring-gradient)"}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums leading-none">{value}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">/ {target} kcal</span>
        <span
          className="text-[10px] font-semibold tabular-nums"
          style={{
            background: "var(--primary-gradient)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {percent}%
        </span>
      </div>
    </div>
  );
}

/** Kleiner Ring für die kompakte Sticky-Leiste (Lila→Indigo-Verlauf). */
function CompactRing({ ratio }: { ratio: number }) {
  const size = 30;
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="planner-compact-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="url(#planner-compact-gradient)"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
    </span>
  );
}

/** Kleiner Fortschrittsring pro Wochentag mit Datum in der Mitte. */
function MiniDayRing({
  ratio,
  filled,
  active,
  label,
}: {
  ratio: number;
  filled: boolean;
  active: boolean;
  label: string;
}) {
  const size = 26;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={active ? "stroke-primary-foreground/30" : "stroke-muted"}
        />
        {filled && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            className={active ? "stroke-primary-foreground" : "stroke-primary"}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold tabular-nums">
        {label}
      </span>
    </span>
  );
}
