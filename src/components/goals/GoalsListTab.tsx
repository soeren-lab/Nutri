import { Activity, Scale, SlidersHorizontal, Target } from "lucide-react";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsList";
import { useBodyMeasurements } from "@/hooks/use-body-measurements";
import { useNutritionTargets } from "@/hooks/use-nutrition-targets";
import { useTracking } from "@/hooks/use-tracking";
import { MACRO_POINTS } from "@/lib/points";
import { TRACKABLE_KEYS } from "@/lib/tracking";

function fmt(n: number): string {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

/** Ziele als Einstellungs-Liste mit Unterseiten. */
export function GoalsListTab() {
  const { profile, targets } = useNutritionTargets();
  const { tracking } = useTracking();
  const { latestWeight } = useBodyMeasurements();

  const weightSubtitle =
    latestWeight?.weight_kg != null
      ? `Zuletzt: ${fmt(Number(latestWeight.weight_kg))} kg am ${latestWeight.date.slice(8, 10)}.${latestWeight.date.slice(5, 7)}.`
      : "Noch kein Gewicht eingetragen";

  const bodyParts = [
    profile?.weight_kg != null ? `${fmt(Number(profile.weight_kg))} kg` : null,
    profile?.height_cm != null ? `${fmt(Number(profile.height_cm))} cm` : null,
    profile?.age != null ? `${profile.age} Jahre` : null,
  ].filter(Boolean) as string[];

  const targetSubtitle = targets
    ? `${targets.calories} kcal · ${targets.manual ? "Eigene Werte aktiv" : "Automatisch berechnet"}`
    : "Noch keine Ziel-Werte";

  const keys = [...TRACKABLE_KEYS, "sugar_g" as const];
  const activeCount = keys.filter((k) => tracking[k]).length;
  const maxBase =
    MACRO_POINTS.calories +
    TRACKABLE_KEYS.reduce((sum, key) => sum + (tracking[key] ? MACRO_POINTS[key] : 0), 0);

  return (
    <div className="space-y-6">
      <SettingsGroup title="Körperdaten">
        <SettingsRow
          to="/profile/settings/body"
          icon={Activity}
          title="Körperdaten"
          subtitle={bodyParts.length ? bodyParts.join(" · ") : "Noch nicht ausgefüllt"}
        />
        <SettingsRow
          to="/profile/settings/weight"
          icon={Scale}
          title="Gewicht eintragen"
          subtitle={weightSubtitle}
        />
      </SettingsGroup>


      <SettingsGroup title="Zielwerte">
        <SettingsRow
          to="/profile/settings/targets"
          icon={Target}
          title="Tagesziele"
          subtitle={targetSubtitle}
        />
      </SettingsGroup>

      <SettingsGroup title="Tracking">
        <SettingsRow
          to="/profile/settings/tracking"
          icon={SlidersHorizontal}
          title="Tracking-Einstellungen"
          subtitle={`${activeCount} von ${keys.length} aktiv · max. ${maxBase} Basispunkte`}
        />
      </SettingsGroup>
    </div>
  );
}
