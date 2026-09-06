import { createFileRoute } from "@tanstack/react-router";
import { AppearanceSection } from "@/components/AppearanceSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/appearance")({
  head: () => ({
    meta: [
      { title: "Darstellung – Hell, Dunkel oder System" },
      {
        name: "description",
        content: "Wähle zwischen hellem, dunklem oder systemabhängigem Erscheinungsbild.",
      },
      { property: "og:title", content: "Darstellung" },
      { property: "og:description", content: "Hell, Dunkel oder System auswählen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="Darstellung">
      <AppearanceSection />
    </SettingsSubPage>
  ),
});
