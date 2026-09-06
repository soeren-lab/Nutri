import { createFileRoute } from "@tanstack/react-router";
import { BodyDataPanel } from "@/components/goals/BodyDataPanel";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/body")({
  head: () => ({
    meta: [
      { title: "Körperdaten – Gewicht, Größe und Ziel" },
      {
        name: "description",
        content:
          "Hinterlege Gewicht, Größe, Alter, Geschlecht, Aktivitätslevel und dein Ziel.",
      },
      { property: "og:title", content: "Körperdaten" },
      {
        property: "og:description",
        content: "Gewicht, Größe, Alter, Aktivitätslevel und Ziel festlegen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage
      title="Körperdaten"
      description="Grundlage für die Berechnung deiner Ziel-Werte."
      backTab="goals"
    >
      <BodyDataPanel />
    </SettingsSubPage>
  ),
});
