import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame, Medal, Star, TrendingUp } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RankBadge } from "@/components/RankBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  friendComparisonQuery,
  type ComparisonEntry,
} from "@/lib/friend-comparison";
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/achievements";

/** Anzahl erreichbarer Abzeichen (ziel-spezifische Varianten nur einmal). */
const BADGE_TOTAL = ACHIEVEMENT_DEFINITIONS.filter(
  (d) => !d.goals || d.goals.includes("lose"),
).length;
import { rankForPoints } from "@/lib/ranks";
import { cn } from "@/lib/utils";

type Metric = "rank" | "streak" | "week" | "badges";

const TABS: { key: Metric; label: string; icon: typeof Medal }[] = [
  { key: "rank", label: "Rang", icon: Medal },
  { key: "streak", label: "Streak", icon: Flame },
  { key: "week", label: "Diese Woche", icon: TrendingUp },
  { key: "badges", label: "Abzeichen", icon: Star },
];

function valueOf(e: ComparisonEntry, metric: Metric): number {
  switch (metric) {
    case "rank":
      return e.totalPoints;
    case "streak":
      return e.currentStreakDays;
    case "week":
      return e.weekAvgPoints;
    case "badges":
      return e.achievementCount;
  }
}

function labelOf(e: ComparisonEntry, metric: Metric): string {
  switch (metric) {
    case "rank":
      return `${e.totalPoints.toLocaleString("de-DE")} Pkt`;
    case "streak":
      return `${e.currentStreakDays} ${e.currentStreakDays === 1 ? "Tag" : "Tage"}`;
    case "week":
      return `Ø ${e.weekAvgPoints.toLocaleString("de-DE")} Pkt · ${e.weekDays}/7 Tage`;
    case "badges":
      return `${e.achievementCount}/${BADGE_TOTAL}`;
  }
}

/**
 * Freunde-Vergleich: vier Leaderboards (Rang, Streak, Wochenschnitt, Abzeichen)
 * über alle bestätigten Freunde plus die eigene Position.
 */
export function FriendComparison({
  onGoToFriends,
}: {
  onGoToFriends?: () => void;
}) {
  const [metric, setMetric] = useState<Metric>("rank");
  const q = useQuery(friendComparisonQuery());
  const entries = q.data ?? [];

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          valueOf(b, metric) - valueOf(a, metric) ||
          b.totalPoints - a.totalPoints,
      ),
    [entries, metric],
  );

  const selfIndex = sorted.findIndex((e) => e.isSelf);
  const top = sorted.slice(0, 10);
  const selfOutside = selfIndex >= 10 ? sorted[selfIndex] : null;
  const friendCount = entries.filter((e) => !e.isSelf).length;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">Freunde-Vergleich</p>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setMetric(t.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                metric === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {q.isLoading ? (
        <LoadingSpinner />
      ) : friendCount === 0 ? (
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            Füge Freunde hinzu, um dich zu vergleichen.
          </p>
          {onGoToFriends && (
            <Button size="sm" variant="outline" onClick={onGoToFriends}>
              Zum Freunde-Bereich
            </Button>
          )}
        </div>
      ) : (
        <ol className="space-y-2">
          {top.map((e, i) => (
            <Row key={e.userId} entry={e} place={i + 1} metric={metric} />
          ))}
          {selfOutside && (
            <>
              <li className="text-center text-xs text-muted-foreground">…</li>
              <Row
                entry={selfOutside}
                place={selfIndex + 1}
                metric={metric}
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
  metric,
  prefix,
}: {
  entry: ComparisonEntry;
  place: number;
  metric: Metric;
  prefix?: string;
}) {
  const tier = rankForPoints(entry.totalPoints).current;
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
        label={entry.username}
        avatarUrl={entry.avatarUrl}
        className="h-9 w-9"
        ring={entry.isSelf}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {entry.isSelf ? "Du" : `@${entry.username}`}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {labelOf(entry, metric)}
        </p>
      </div>
      <RankBadge tier={tier} size={28} />
    </li>
  );
}
