import { createFileRoute } from "@tanstack/react-router";
import { EmailPanel } from "@/components/AccountSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/email")({
  head: () => ({
    meta: [
      { title: "E-Mail-Adresse ändern – Nutri" },
      { name: "description", content: "Hinterlege eine neue E-Mail-Adresse für dein Konto." },
      { property: "og:title", content: "E-Mail ändern" },
      { property: "og:description", content: "Neue E-Mail-Adresse für dein Konto hinterlegen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="E-Mail" description="Ändere die E-Mail-Adresse deines Kontos.">
      <EmailPanel />
    </SettingsSubPage>
  ),
});
