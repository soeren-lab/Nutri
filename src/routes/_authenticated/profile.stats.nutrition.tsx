import { createFileRoute } from "@tanstack/react-router";
import { StatsSection } from "@/components/StatsSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/stats/nutrition")({
  head: () => ({
    meta: [
      { title: "Ernährungs-Statistik – Kalorien und Makros im Verlauf" },
      {
        name: "description",
        content:
          "Kalorien- und Makro-Verlauf über frei wählbare Zeiträume mit Ziel-Vergleich.",
      },
      { property: "og:title", content: "Ernährungs-Statistik" },
      {
        property: "og:description",
        content: "Kalorien und Makros im Verlauf, verglichen mit deinen Tageszielen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage
      title="Ernährungs-Statistik"
      description="Kalorien- und Makro-Verlauf im Ziel-Vergleich."
      backTab="progress"
    >
      <StatsSection />
    </SettingsSubPage>
  ),
});
