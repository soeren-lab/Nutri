import { createFileRoute } from "@tanstack/react-router";
import { DeleteAccountPanel } from "@/components/AccountSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/delete")({
  head: () => ({
    meta: [
      { title: "Account löschen – Nutri" },
      { name: "description", content: "Lösche deinen Account und alle zugehörigen Daten." },
      { property: "og:title", content: "Account löschen" },
      { property: "og:description", content: "Account und alle Daten unwiderruflich löschen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="Account löschen">
      <DeleteAccountPanel />
    </SettingsSubPage>
  ),
});
