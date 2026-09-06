import { createFileRoute } from "@tanstack/react-router";
import { PasswordPanel } from "@/components/AccountSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/password")({
  head: () => ({
    meta: [
      { title: "Passwort ändern – Nutri" },
      { name: "description", content: "Wähle ein neues Passwort für deinen Account." },
      { property: "og:title", content: "Passwort ändern" },
      { property: "og:description", content: "Neues Passwort für deinen Account setzen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="Passwort" description="Wähle ein neues Passwort für deinen Account.">
      <PasswordPanel />
    </SettingsSubPage>
  ),
});
