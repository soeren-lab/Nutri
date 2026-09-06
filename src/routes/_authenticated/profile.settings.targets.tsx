import { createFileRoute } from "@tanstack/react-router";
import { TargetValuesPanel } from "@/components/goals/TargetValuesPanel";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/targets")({
  head: () => ({
    meta: [
      { title: "Tagesziele – Kalorien und Makros festlegen" },
      {
        name: "description",
        content:
          "Ziel-Kalorien und Makros automatisch berechnen lassen oder eigene Werte eingeben.",
      },
      { property: "og:title", content: "Tagesziele" },
      {
        property: "og:description",
        content: "Kalorien, Protein, Kohlenhydrate, Fett, Ballaststoffe und Zucker.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage
      title="Tagesziele"
      description="Automatisch berechnet oder mit eigenen Werten."
      backTab="goals"
    >
      <TargetValuesPanel />
    </SettingsSubPage>
  ),
});
