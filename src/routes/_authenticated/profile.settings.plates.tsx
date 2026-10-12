import { createFileRoute } from "@tanstack/react-router";
import { PlatesSection } from "@/components/PlatesSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/plates")({
  head: () => ({
    meta: [
      { title: "Meine Teller – Maße für den Foto-Scan" },
      {
        name: "description",
        content:
          "Teller und Schüsseln mit Maßen hinterlegen, damit der Foto-Scan Mengen besser schätzt.",
      },
      { property: "og:title", content: "Meine Teller" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="Meine Teller">
      <PlatesSection />
    </SettingsSubPage>
  ),
});
