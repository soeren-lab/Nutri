import { createFileRoute } from "@tanstack/react-router";
import { RankPanel } from "@/components/progress/RankPanel";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/stats/rank")({
  head: () => ({
    meta: [
      { title: "Season-Rang – Punkte und Fortschritt" },
      {
        name: "description",
        content:
          "Dein aktueller Season-Rang mit Punkte-Verlauf, Streak-Multiplikator und Rang-Legende.",
      },
      { property: "og:title", content: "Season-Rang" },
      {
        property: "og:description",
        content: "Punkte-Verlauf, Streak-Multiplikator und alle Ränge im Überblick.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage
      title="Season-Rang"
      description="Punkte-Verlauf und Rang-Fortschritt der laufenden Season."
      backTab="progress"
    >
      <RankPanel />
    </SettingsSubPage>
  ),
});
