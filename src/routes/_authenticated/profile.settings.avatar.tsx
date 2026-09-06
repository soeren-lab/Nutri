import { createFileRoute } from "@tanstack/react-router";
import { AvatarUpload } from "@/components/AvatarUpload";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/avatar")({
  head: () => ({
    meta: [
      { title: "Profilbild ändern – Nutri" },
      {
        name: "description",
        content: "Lade ein Profilbild hoch, ändere oder entferne es.",
      },
      { property: "og:title", content: "Profilbild ändern" },
      { property: "og:description", content: "Profilbild hochladen, ändern oder entfernen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="Profilbild">
      <AvatarUpload />
    </SettingsSubPage>
  ),
});
