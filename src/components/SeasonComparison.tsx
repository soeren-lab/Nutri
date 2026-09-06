import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RankBadge } from "@/components/RankBadge";
import { UserAvatar } from "@/components/UserAvatar";
import {
  currentSeasonQuery,
  seasonComparisonQuery,
  seasonHistoryComparisonQuery,
  seasonHistoryQuery,
  type SeasonComparisonEntry,
} from "@/lib/seasons";
import { seasonRankForPoints, seasonTierByKey } from "@/lib/ranks";
import { cn } from "@/lib/utils";

/**
 * Freunde-Vergleich der Season-Punkte: laufende Season und abgeschlossene
 * Seasons als Rangliste.
 */
export function SeasonComparison() {
  const [scope, setScope] = useState<"current" | "past">("current");
  const currentQ = useQuery(currentSeasonQuery());
  const historyQ = useQuery(seasonHistoryQuery());
  const pastSeasons = historyQ.data ?? [];
  const [pastId, setPastId] = useState<string | null>(null);
  const selectedPast = pastId ?? pastSeasons[0]?.season_id ?? null;

  const liveQ = useQuery({
    ...seasonComparisonQuery(currentQ.data?.id),
    enabled: scope === "current" && !!currentQ.data?.id,
  });
  const pastQ = useQuery({
    ...seasonHistoryComparisonQuery(selectedPast ?? undefined),
    enabled: scope === "past" && !!selectedPast,
  });

  const active = scope === "current" ? liveQ : pastQ;
  const entries = active.data ?? [];

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.points - a.points),
    [entries],
  );
  const selfIndex = sorted.findIndex((e) => e.isSelf);
  const top = sorted.slice(0, 10);
  const selfOutside = selfIndex >= 10 ? sorted[selfIndex] : null;
  const friendCount = entries.filter((e) => !e.isSelf).length;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">Season-Vergleich</p>

      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {(
          [
            ["current", "Aktuelle Season"],
            ["past", "Vergangene Seasons"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setScope(key)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              scope === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {scope === "past" && pastSeasons.length > 1 && (
        <div className="flex gap-1 overflow-x-auto">
          {pastSeasons.map((s) => (
            <button
              key={s.season_id}
              type="button"
              onClick={() => setPastId(s.season_id)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium",
                selectedPast === s.season_id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {s.season?.name ?? "Season"}
            </button>
          ))}
        </div>
      )}

      {scope === "past" && pastSeasons.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine abgeschlossene Season.
        </p>
      ) : active.isLoading ? (
        <LoadingSpinner />
      ) : friendCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          Füge Freunde hinzu, um dich zu vergleichen.
        </p>
      ) : (
        <ol className="space-y-2">
          {top.map((e, i) => (
            <Row key={e.userId} entry={e} place={i + 1} scope={scope} />
          ))}
          {selfOutside && (
            <>
              <li className="text-center text-xs text-muted-foreground">…</li>
              <Row
                entry={selfOutside}
                place={selfIndex + 1}
                scope={scope}
                prefix="Du: Platz "
              />
            </>
          )}
        </ol>
      )}
    </section>
  );
}

function Row({
  entry,
  place,
  scope,
  prefix,
}: {
  entry: SeasonComparisonEntry;
  place: number;
  scope: "current" | "past";
  prefix?: string;
}) {
  const tier =
    scope === "past" && entry.rankKey
      ? seasonTierByKey(entry.rankKey)
      : seasonRankForPoints(entry.points).current;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border border-transparent px-2 py-2",
        entry.isSelf && "border-primary/40 bg-primary/10",
      )}
    >
      <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
        {prefix ? `${prefix}${place}` : `#${place}`}
      </span>
      <UserAvatar
        label={entry.username ?? ""}
        avatarUrl={entry.avatarUrl}
        className="h-9 w-9"
        ring={entry.isSelf}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {entry.isSelf ? "Du" : `@${entry.username}`}
        </p>
        <p className="truncate text-xs text-muted-foreground tabular-nums">
          {entry.points.toLocaleString("de-DE")} Pkt · {tier.label}
          {scope === "current" && entry.streakDays >= 3
            ? ` · ${entry.streakDays} Tage Serie`
            : ""}
        </p>
      </div>
      <RankBadge tier={tier} size={28} />
    </li>
  );
}
