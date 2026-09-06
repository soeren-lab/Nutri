import { useQuery } from "@tanstack/react-query";
import { Award, BarChart3, Flame, History, Scale, Trophy } from "lucide-react";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsList";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { useAchievements } from "@/hooks/use-achievements";
import { useBodyMeasurements } from "@/hooks/use-body-measurements";
import { useExperimentalMode } from "@/hooks/use-experimental-mode";
import { useUserRank } from "@/hooks/use-user-rank";
import { startOfWeek, toISODate } from "@/lib/meal-plan";
import { currentStreak, todayDate } from "@/lib/progress";
import { seasonHistoryQuery } from "@/lib/seasons";

function fmt(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

/** Fortschritt als Einstellungs-Liste mit Unterseiten (Experimental: Dashboard). */
export function ProgressTab() {
  const { enabled: glassEnabled } = useExperimentalMode();
  const { rank, totalPoints } = useUserRank();
  const history = useQuery(seasonHistoryQuery());
  const { days, achievements, unlockedCount } = useAchievements();
  const { latestWeight, trend } = useBodyMeasurements();

  const streak = currentStreak(days);

  const weekStart = toISODate(startOfWeek(todayDate()));
  const weekDays = days.filter((d) => d.date >= weekStart);
  const weekHits = weekDays.filter((d) => d.inTarget).length;

  const weightParts = [
    latestWeight?.weight_kg != null ? `${fmt(Number(latestWeight.weight_kg))} kg` : null,
    trend ? `${trend.delta > 0 ? "+" : ""}${fmt(trend.delta)} kg letzte ${trend.days} Tage` : null,
  ].filter(Boolean) as string[];

  const seasonCount = history.data?.length ?? 0;

  if (glassEnabled) {
    return (
      <ProgressDashboard
        streak={streak}
        rank={rank}
        totalPoints={totalPoints}
        weekDays={weekDays}
        weekHits={weekHits}
        achievements={achievements}
        unlockedCount={unlockedCount}
        weightSubtitle={weightParts.length ? weightParts.join(" · ") : "Noch keine Einträge"}
        seasonSubtitle={
          seasonCount === 0
            ? "Noch keine abgeschlossene Season"
            : `${seasonCount} ${seasonCount === 1 ? "abgeschlossene Season" : "abgeschlossene Seasons"}`
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <SettingsGroup title="Season">
        <SettingsRow
          to="/profile/stats/rank"
          icon={Trophy}
          title="Season-Rang"
          subtitle={`${rank.current.label} · ${totalPoints.toLocaleString("de-DE")} Punkte`}
        />
        <SettingsRow
          to="/profile/stats/seasons"
          icon={History}
          title="Season-Historie"
          subtitle={
            seasonCount === 0
              ? "Noch keine abgeschlossene Season"
              : `${seasonCount} ${seasonCount === 1 ? "abgeschlossene Season" : "abgeschlossene Seasons"}`
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Körperwerte">
        <SettingsRow
          to="/profile/stats/weight"
          icon={Scale}
          title="Gewichtsverlauf"
          subtitle={weightParts.length ? weightParts.join(" · ") : "Noch keine Einträge"}
        />
      </SettingsGroup>

      <SettingsGroup title="Streak & Ernährung">
        <SettingsRow
          to="/profile/stats/streak"
          icon={Flame}
          title="Streak"
          subtitle={`${streak} ${streak === 1 ? "Tag" : "Tage"} in Folge`}
        />
        <SettingsRow
          to="/profile/stats/nutrition"
          icon={BarChart3}
          title="Ernährungs-Statistik"
          subtitle={`Diese Woche: ${weekHits} von ${Math.max(1, weekDays.length)} im Ziel`}
        />
      </SettingsGroup>

      <SettingsGroup title="Abzeichen">
        <SettingsRow
          to="/profile/stats/badges"
          icon={Award}
          title="Abzeichen"
          subtitle={`${unlockedCount}/${achievements.length} freigeschaltet`}
        />
      </SettingsGroup>
    </div>
  );
}
