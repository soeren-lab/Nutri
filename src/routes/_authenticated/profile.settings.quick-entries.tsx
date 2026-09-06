import { createFileRoute } from "@tanstack/react-router";
import { QuickEntryTemplatesSection } from "@/components/QuickEntryTemplatesSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/quick-entries")({
  head: () => ({
    meta: [
      { title: "Meine Schnelleinträge – Vorlagen verwalten" },
      {
        name: "description",
        content: "Verwalte deine Vorlagen für spontane Mahlzeiten im Planer.",
      },
      { property: "og:title", content: "Meine Schnelleinträge" },
      { property: "og:description", content: "Vorlagen für spontane Mahlzeiten verwalten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="Meine Schnelleinträge">
      <QuickEntryTemplatesSection />
    </SettingsSubPage>
  ),
});
