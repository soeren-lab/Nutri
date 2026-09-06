import { createFileRoute } from "@tanstack/react-router";
import { SeasonHistorySection } from "@/components/SeasonHistorySection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/stats/seasons")({
  head: () => ({
    meta: [
      { title: "Season-Historie – abgeschlossene Seasons" },
      {
        name: "description",
        content: "Endrang, Punkte und Punkte-Verlauf deiner abgeschlossenen Seasons.",
      },
      { property: "og:title", content: "Season-Historie" },
      {
        property: "og:description",
        content: "Rückblick auf Endrang und Punkte vergangener Seasons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage
      title="Season-Historie"
      description="Endrang und Punkte deiner abgeschlossenen Seasons."
      backTab="progress"
    >
      <SeasonHistorySection />
    </SettingsSubPage>
  ),
});
