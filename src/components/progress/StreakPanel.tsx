import { Flame } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StreakHeatmap } from "@/components/StreakHeatmap";
import { useAchievements } from "@/hooks/use-achievements";
import { currentStreak } from "@/lib/progress";

/** Aktuelle Serie mit Kalender-Heatmap. */
export function StreakPanel() {
  const { days, isLoading } = useAchievements();
  const streak = currentStreak(days);
  const targetStreak = currentStreak(days, (d) => d.inTarget);

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Streak</h2>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30">
              <Flame className="h-7 w-7" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold leading-none tabular-nums text-primary">
                  {streak}
                </span>
                <span className="text-sm font-semibold">
                  {streak === 1 ? "Tag in Folge" : "Tage in Folge"}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                davon {targetStreak} {targetStreak === 1 ? "Tag" : "Tage"} im
                Zielkorridor
              </p>
            </div>
          </div>
          <StreakHeatmap days={days} />
        </>
      )}
    </section>
  );
}
