import { AchievementGrid } from "@/components/AchievementGrid";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAchievements } from "@/hooks/use-achievements";

/** Vollständiges Abzeichen-Raster. */
export function BadgePanel() {
  const { achievements, unlockedCount, isLoading } = useAchievements();

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Abzeichen</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {unlockedCount}/{achievements.length}
        </span>
      </div>
      {isLoading ? <LoadingSpinner /> : <AchievementGrid achievements={achievements} />}
    </section>
  );
}
