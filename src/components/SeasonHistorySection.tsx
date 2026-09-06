import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RankBadge } from "@/components/RankBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  seasonHistoryQuery,
  seasonLogQuery,
  type SeasonHistoryRow,
} from "@/lib/seasons";
import { RANK_ICONS, seasonTierByKey } from "@/lib/ranks";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/** Abgeschlossene Seasons mit Endrang, Punkten und Punkte-Verlauf. */
export function SeasonHistorySection() {
  const q = useQuery(seasonHistoryQuery());
  const [open, setOpen] = useState<SeasonHistoryRow | null>(null);
  const rows = q.data ?? [];

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">Season-Historie</p>

      {q.isLoading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine abgeschlossene Season – deine erste Season läuft gerade.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const tier = seasonTierByKey(r.final_rank);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpen(r)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2 text-left transition-colors hover:bg-muted/60"
                >
                  <RankBadge tier={tier} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {r.season?.name ?? "Season"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground tabular-nums">
                      {r.final_points.toLocaleString("de-DE")} Pkt · {tier.label}
                      {r.final_placement_among_friends
                        ? ` · Platz ${r.final_placement_among_friends} bei Freunden`
                        : ""}
                    </p>
                  </div>
                  {r.season && (
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                      {formatDate(r.season.start_date)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{open?.season?.name ?? "Season"}</DialogTitle>
          </DialogHeader>
          {open && <SeasonChart seasonId={open.season_id} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SeasonChart({ seasonId }: { seasonId: string }) {
  const q = useQuery(seasonLogQuery(seasonId));
  const cfg = RANK_ICONS.gold;
  const data = (q.data ?? []).map((r) => ({
    date: formatDate(r.date),
    points: r.points_earned,
  }));

  if (q.isLoading) return <LoadingSpinner />;
  if (data.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Für diese Season liegen keine Tagespunkte vor.
      </p>
    );

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="seasonPoints" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cfg.from} stopOpacity={0.6} />
              <stop offset="100%" stopColor={cfg.to} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip
            formatter={(v: number) => [`${v} Pkt`, "Punkte"]}
            labelClassName="text-xs"
            contentStyle={{ fontSize: 12, borderRadius: 12 }}
          />
          <Area
            type="monotone"
            dataKey="points"
            stroke={cfg.to}
            fill="url(#seasonPoints)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
