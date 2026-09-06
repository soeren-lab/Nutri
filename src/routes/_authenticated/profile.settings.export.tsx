import { createFileRoute } from "@tanstack/react-router";
import { ExportPanel } from "@/components/AccountSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/export")({
  head: () => ({
    meta: [
      { title: "Daten exportieren – Nutri" },
      {
        name: "description",
        content: "Lade eine Kopie deiner Rezepte und Planer-Daten herunter.",
      },
      { property: "og:title", content: "Daten exportieren" },
      { property: "og:description", content: "Kopie deiner Rezepte und Planer-Daten anfordern." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="Daten exportieren">
      <ExportPanel />
    </SettingsSubPage>
  ),
});
