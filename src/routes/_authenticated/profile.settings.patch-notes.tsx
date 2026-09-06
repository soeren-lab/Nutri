import { createFileRoute } from "@tanstack/react-router";
import { PatchNotesDevSection } from "@/components/PatchNotesDevSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/patch-notes")({
  head: () => ({
    meta: [
      { title: "Patch Notes verwalten – Entwickler" },
      { name: "description", content: "Patch Notes erstellen und verwalten." },
      { property: "og:title", content: "Patch Notes verwalten" },
      { property: "og:description", content: "Patch Notes erstellen und löschen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="Patch Notes">
      <PatchNotesDevSection />
    </SettingsSubPage>
  ),
});
