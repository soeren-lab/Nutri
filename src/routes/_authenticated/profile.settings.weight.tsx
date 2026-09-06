import { createFileRoute } from "@tanstack/react-router";
import { WeightEntryPanel } from "@/components/progress/WeightEntryPanel";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/weight")({
  head: () => ({
    meta: [
      { title: "Gewicht eintragen – Körperwerte erfassen" },
      {
        name: "description",
        content:
          "Gewicht, Körperfettanteil, Datum und eine Notiz für deinen Verlauf eintragen.",
      },
      { property: "og:title", content: "Gewicht eintragen" },
      {
        property: "og:description",
        content: "Körperwerte mit Gewicht, KFA, Datum und Notiz erfassen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage
      title="Gewicht eintragen"
      description="Neue Körperwerte für deinen Verlauf erfassen."
      backTab="goals"
    >
      <WeightEntryPanel />
    </SettingsSubPage>
  ),
});
