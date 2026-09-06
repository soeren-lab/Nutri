import { createFileRoute } from "@tanstack/react-router";
import { WeightHistoryPanel } from "@/components/progress/WeightHistoryPanel";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/stats/weight")({
  head: () => ({
    meta: [
      { title: "Gewichtsverlauf – Gewicht und Körperfett" },
      {
        name: "description",
        content:
          "Gewicht, Körperfett und Trend als Verlauf mit Zeitraum-Filter und Einträge-Liste.",
      },
      { property: "og:title", content: "Gewichtsverlauf" },
      {
        property: "og:description",
        content: "Kennzahlen, Chart und vergangene Einträge deiner Körperwerte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage
      title="Gewichtsverlauf"
      description="Kennzahlen, Verlauf und vergangene Einträge."
      backTab="progress"
    >
      <WeightHistoryPanel />
    </SettingsSubPage>
  ),
});
