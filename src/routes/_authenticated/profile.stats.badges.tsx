import { createFileRoute } from "@tanstack/react-router";
import { BadgePanel } from "@/components/progress/BadgePanel";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/stats/badges")({
  head: () => ({
    meta: [
      { title: "Abzeichen – alle Erfolge im Überblick" },
      {
        name: "description",
        content: "Alle Abzeichen mit Fortschritt und freigeschalteten Erfolgen.",
      },
      { property: "og:title", content: "Abzeichen" },
      {
        property: "og:description",
        content: "Fortschritt und freigeschaltete Abzeichen im Überblick.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage
      title="Abzeichen"
      description="Alle Abzeichen mit deinem Fortschritt."
      backTab="progress"
    >
      <BadgePanel />
    </SettingsSubPage>
  ),
});
