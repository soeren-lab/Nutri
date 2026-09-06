import { useState } from "react";
import { ChevronDown, Sparkles, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RankBadge } from "@/components/RankBadge";
import { useRankStatistics } from "@/hooks/use-rank-statistics";
import { RANK_ICONS } from "@/lib/ranks";
import { cn } from "@/lib/utils";

/** Kurzformat 18.08. aus ISO-Datum. */
function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

const RANGES: { label: string; days: 7 | 30 }[] = [
  { label: "7 Tage", days: 7 },
  { label: "30 Tage", days: 30 },
];

/** Erweiterte Rang- und Punkte-Statistiken (Historie, Ø, bester Tag, Herkunft, Prognose). */
export function RankStatisticsSection({ className }: { className?: string }) {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const stats = useRankStatistics(rangeDays);

  const visibleHistory = showAllHistory
    ? stats.history
    : stats.history.slice(0, 3);
  const maxSource = Math.max(1, ...stats.sources.map((s) => s.points));
  const rangeLabel = rangeDays === 7 ? "letzter Woche" : "letztem Monat";

  return (
    <section
      className={cn("space-y-4 rounded-2xl border border-border bg-card p-4", className)}
    >
      <h2 className="text-sm font-semibold">Rang-Statistik</h2>

      {stats.isLoading ? (
        <LoadingSpinner />
      ) : stats.history.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Punkte-Historie – sobald du Tage abschließt, erscheint hier deine
          Rang-Entwicklung.
        </p>
      ) : (
        <>
          {/* 1. Aufstiegs-Historie */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Aufstiege</p>
            <ol className="space-y-0">
              {visibleHistory.map((entry) => {
                const cfg = RANK_ICONS[entry.tier.group];
                return (
                  <li key={entry.tier.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          background: `linear-gradient(135deg, ${cfg.from}, ${cfg.to})`,
                        }}
                      />
                      <span className="w-px flex-1 bg-border" />
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2 pb-3">
                      <RankBadge tier={entry.tier} size={26} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {entry.tier.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {entry.isCurrent
                            ? `seit ${shortDate(entry.since)}`
                            : `${shortDate(entry.since)}–${shortDate(entry.until!)} (${entry.days} ${entry.days === 1 ? "Tag" : "Tage"})`}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {stats.history.length > 3 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full text-xs"
                onClick={() => setShowAllHistory((v) => !v)}
              >
                {showAllHistory
                  ? "Weniger anzeigen"
                  : `Ältere anzeigen (${stats.history.length - 3})`}
                <ChevronDown
                  className={cn("ml-1 h-3.5 w-3.5", showAllHistory && "rotate-180")}
                />
              </Button>
            ) : null}
          </div>

          {/* Zeitraum-Chips */}
          <div className="flex gap-2">
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

          {/* 2. Ø Punkte/Tag + 3. Bester Tag */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xl font-bold tabular-nums">{stats.average}</p>
              <p className="text-[11px] text-muted-foreground">Ø Punkte/Tag</p>
              <p
                className={cn(
                  "mt-1 flex items-center gap-1 text-[11px] font-semibold tabular-nums",
                  stats.averageDelta >= 0 ? "text-emerald-500" : "text-destructive",
                )}
              >
                {stats.averageDelta >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {stats.averageDelta >= 0 ? "+" : ""}
                {stats.averageDelta} ggü. {rangeLabel}
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-3">
              <p className="flex items-center gap-1.5 text-xl font-bold tabular-nums">
                <Trophy className="h-4 w-4 text-primary" />
                {stats.bestDay?.points ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Bester Tag
                {stats.bestDay ? ` – ${shortDate(stats.bestDay.date)}` : ""}
              </p>
            </div>
          </div>

          {/* 4. Punkte-Herkunft */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium text-muted-foreground">Punkte-Herkunft</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {stats.rangeTotal} Punkte
              </p>
            </div>
            {stats.sources.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Keine Punkte im gewählten Zeitraum.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {stats.sources.map((s) => (
                  <li key={s.key} className="space-y-1">
                    <div className="flex items-baseline justify-between text-xs">
                      <span>{s.label}</span>
                      <span className="font-semibold tabular-nums">{s.points}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${Math.round((s.points / maxSource) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 5. Prognose */}
          {stats.daysToNextRank != null && stats.nextRank ? (
            <p className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>
                Bei deinem aktuellen Tempo erreichst du{" "}
                <span className="font-semibold text-foreground">
                  {stats.nextRank.label}
                </span>{" "}
                in ca.{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {stats.daysToNextRank}
                </span>{" "}
                {stats.daysToNextRank === 1 ? "Tag" : "Tagen"}.
              </span>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
