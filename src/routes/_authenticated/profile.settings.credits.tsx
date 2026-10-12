import { createFileRoute } from "@tanstack/react-router";
import { CreditsSection } from "@/components/CreditsSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/credits")({
  head: () => ({
    meta: [
      { title: "Mein Guthaben – Foto-Scan" },
      {
        name: "description",
        content: "Guthaben für den Foto-Scan und Verlauf der Buchungen.",
      },
      { property: "og:title", content: "Mein Guthaben" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="Mein Guthaben">
      <CreditsSection />
    </SettingsSubPage>
  ),
});
