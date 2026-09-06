import { Link } from "@tanstack/react-router";
import { Award, ChevronRight, History, Scale } from "lucide-react";
import type { AchievementState } from "@/lib/achievements";
import type { ProgressDay } from "@/lib/progress";
import type { RankInfo } from "@/lib/ranks";
import { cn } from "@/lib/utils";

const WEEKDAY_LETTERS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Ring mit Lila→Indigo-Verlauf, wie im Planer – für Streak/Rang-Fortschritt. */
function HeroRing({
  gradientId,
  ratio,
  size = 92,
  children,
}: {
  gradientId: string;
  ratio: number;
  size?: number;
  children: React.ReactNode;
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
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
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Kompakte Zeile für ein Feature, das nicht als Ring/Karte passt (z.B. Season-Historie). */
function DashboardRow({
  to,
  icon: Icon,
  title,
  subtitle,
}: {
  to: string;
  icon: typeof Scale;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)] transition-colors hover:bg-muted/40"
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/**
 * Glass-Dashboard für den Fortschritt-Tab (Experimental-Modus): Streak- und
 * Rang-Ring, Wochenaktivität und Erfolge – dieselben Daten/Navigationsziele
 * wie die klassische Listenansicht, nur als zusammenhängendes Dashboard.
 */
export function ProgressDashboard({
  streak,
  rank,
  totalPoints,
  weekDays,
  weekHits,
  achievements,
  unlockedCount,
  weightSubtitle,
  seasonSubtitle,
}: {
  streak: number;
  rank: RankInfo;
  totalPoints: number;
  weekDays: ProgressDay[];
  weekHits: number;
  achievements: AchievementState[];
  unlockedCount: number;
  weightSubtitle: string;
  seasonSubtitle: string;
}) {
  const streakRatio = Math.min(1, streak / 30);
  const featured = [...achievements]
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked))
    .slice(0, 2);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/profile/stats/streak"
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-muted/40"
        >
          <HeroRing gradientId="progress-ring-streak" ratio={streakRatio}>
            <span className="text-xl font-bold tabular-nums leading-none">{streak}</span>
            <span className="text-[10px] text-muted-foreground">
              {streak === 1 ? "Tag" : "Tage"}
            </span>
          </HeroRing>
          <span className="text-xs font-semibold text-muted-foreground">Streak</span>
        </Link>

        <Link
          to="/profile/stats/rank"
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-muted/40"
        >
          <HeroRing gradientId="progress-ring-rank" ratio={rank.progress}>
            <span className="text-sm font-bold tabular-nums leading-none">
              {totalPoints.toLocaleString("de-DE")}
            </span>
            <span className="text-[10px] text-muted-foreground">Punkte</span>
          </HeroRing>
          <span className="truncate text-xs font-semibold text-muted-foreground">
            {rank.current.label}
          </span>
        </Link>
      </div>

      <Link
        to="/profile/stats/nutrition"
        className="block space-y-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">Diese Woche</span>
          <span className="text-sm font-bold tabular-nums text-primary">
            {weekHits} / {weekDays.length || 7}
          </span>
        </div>
        <div className="flex justify-between gap-1.5">
          {weekDays.map((d, i) => (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-muted-foreground">
                {WEEKDAY_LETTERS[i] ?? ""}
              </span>
              <span
                className={cn(
                  "h-6 w-6 rounded-lg",
                  d.inTarget
                    ? "[background:var(--primary-gradient)]"
                    : d.hasEntry
                      ? "bg-muted"
                      : "border border-dashed border-border",
                )}
              />
            </div>
          ))}
        </div>
      </Link>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-semibold text-muted-foreground">Erfolge</h2>
          <Link
            to="/profile/stats/badges"
            className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            {unlockedCount}/{achievements.length} <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {featured.length === 0 ? (
            <Link
              to="/profile/stats/badges"
              className="col-span-2 flex items-center gap-2 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground"
            >
              <Award className="h-4 w-4" /> Noch keine Erfolge freigeschaltet
            </Link>
          ) : (
            featured.map((a) => (
              <Link
                key={a.definition.key}
                to="/profile/stats/badges"
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors",
                  a.unlocked
                    ? "border-border bg-card shadow-[var(--shadow-card)] hover:bg-muted/40"
                    : "border-dashed border-border opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl",
                    a.unlocked
                      ? "[background:var(--primary-gradient)] shadow-[0_6px_16px_-4px_var(--glow-primary)]"
                      : "border border-dashed border-border",
                  )}
                >
                  <a.definition.icon
                    className={cn("h-5 w-5", a.unlocked ? "text-white" : "text-muted-foreground")}
                  />
                </span>
                <span className="truncate text-xs font-semibold">{a.title}</span>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <DashboardRow
          to="/profile/stats/seasons"
          icon={History}
          title="Season-Historie"
          subtitle={seasonSubtitle}
        />
        <DashboardRow
          to="/profile/stats/weight"
          icon={Scale}
          title="Gewichtsverlauf"
          subtitle={weightSubtitle}
        />
      </div>
    </div>
  );
}
