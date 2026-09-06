import { CalendarClock } from "lucide-react";
import { RankBadge } from "@/components/RankBadge";
import { useUserRank } from "@/hooks/use-user-rank";
import { RANK_ICONS } from "@/lib/ranks";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Rang-Anzeige der laufenden Season: Abzeichen, Punktestand, Fortschritt zur
 * nächsten Stufe. Der Rang startet mit jeder Season neu.
 */
export function RankCard({ className }: { className?: string }) {
  const { season, rank, totalPoints, todayPoints, currentStreakDays, daysLeft, isLoading } =
    useUserRank();
  const cfg = RANK_ICONS[rank.current.group];

  return (
    <section
      className={cn(
        "space-y-4 rounded-2xl border border-border bg-card p-4",
        className,
      )}
    >
      {season && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {season.name}
          </p>
          <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <CalendarClock className="h-3.5 w-3.5" />
            {daysLeft} Tage übrig
          </span>
        </div>
      )}

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <RankBadge tier={rank.current} size={72} />
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-xl font-bold">{rank.current.label}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {isLoading ? "…" : `${totalPoints.toLocaleString("de-DE")} Punkte`}
          </p>
          {todayPoints > 0 && (
            <p className="text-xs font-semibold" style={{ color: cfg.to }}>
              +{todayPoints} Punkte heute
            </p>
          )}
          {currentStreakDays >= 3 && (
            <p className="text-xs text-muted-foreground">
              {currentStreakDays} Tage Punkte-Serie
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.round(rank.progress * 100)}%`,
              background: `linear-gradient(90deg, ${cfg.from}, ${cfg.to})`,
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {rank.next
            ? `${rank.pointsIntoTier} / ${rank.tierSpan} – noch ${rank.pointsToNext} Punkte bis ${rank.next.label}`
            : "Höchste Stufe erreicht"}
        </p>
        {season && (
          <p className="text-[11px] text-muted-foreground">
            {formatDate(season.start_date)} – {formatDate(season.end_date)} · Punkte und
            Rang starten mit jeder Season neu
          </p>
        )}
      </div>
    </section>
  );
}
