import { createFileRoute } from "@tanstack/react-router";
import { TrackingSettingsSection } from "@/components/TrackingSettingsSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/tracking")({
  head: () => ({
    meta: [
      { title: "Tracking-Einstellungen – Nährwerte auswählen" },
      {
        name: "description",
        content:
          "Lege fest, welche Nährwerte getrackt und für dein Punktesystem gewertet werden.",
      },
      { property: "og:title", content: "Tracking-Einstellungen" },
      {
        property: "og:description",
        content: "Protein, Kohlenhydrate, Fett, Ballaststoffe und Zucker an- oder abwählen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage
      title="Tracking-Einstellungen"
      description="Kalorien werden immer getrackt."
      backTab="goals"
    >
      <TrackingSettingsSection />
    </SettingsSubPage>
  ),
});
