import { createFileRoute } from "@tanstack/react-router";
import { CreditsAdminSection } from "@/components/CreditsAdminSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/profile/settings/credits-admin")({
  head: () => ({
    meta: [
      { title: "Guthaben verwalten – Admin" },
      { name: "description", content: "Guthaben und KI-Kosten aller User verwalten." },
      { property: "og:title", content: "Guthaben verwalten" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreditsAdminPage,
});

function CreditsAdminPage() {
  const { isAdmin, isLoading } = useIsAdmin();
  return (
    <SettingsSubPage title="Guthaben verwalten">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : isAdmin ? (
        <CreditsAdminSection />
      ) : (
        <p className="text-sm text-muted-foreground">Nur für Admins.</p>
      )}
    </SettingsSubPage>
  );
}
