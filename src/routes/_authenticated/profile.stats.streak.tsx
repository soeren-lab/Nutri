import { createFileRoute } from "@tanstack/react-router";
import { StreakPanel } from "@/components/progress/StreakPanel";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/stats/streak")({
  head: () => ({
    meta: [
      { title: "Streak – Tage in Folge im Zielkorridor" },
      {
        name: "description",
        content: "Deine aktuelle Serie mit Kalender-Heatmap der geloggten Tage.",
      },
      { property: "og:title", content: "Streak" },
      {
        property: "og:description",
        content: "Aktuelle Serie und Kalender-Heatmap deiner geloggten Tage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage
      title="Streak"
      description="Deine Serie und der Kalender der geloggten Tage."
      backTab="progress"
    >
      <StreakPanel />
    </SettingsSubPage>
  ),
});
