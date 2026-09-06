import { useAchievements } from "@/hooks/use-achievements";
import { useUserRank } from "@/hooks/use-user-rank";

/**
 * Prüft im Hintergrund (beim App-Start) neu erfüllte Abzeichen sowie
 * die Punkte-/Rang-Berechnung für abgeschlossene Tage – unabhängig von der Seite.
 */
export function AchievementWatcher() {
  useAchievements({ sync: true });
  useUserRank({ sync: true });
  return null;
}
