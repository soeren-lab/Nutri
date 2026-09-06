import { createFileRoute } from "@tanstack/react-router";
import { SideDishMigrationSection } from "@/components/SideDishMigrationSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/side-dishes")({
  head: () => ({
    meta: [
      { title: "Beilagen entkoppeln – Rezepte aufteilen" },
      {
        name: "description",
        content: "Beilagen-Komponenten als eigene Rezepte anlegen und aus dem Rezept entfernen.",
      },
      { property: "og:title", content: "Beilagen entkoppeln" },
      { property: "og:description", content: "Beilagen als eigene Rezepte auslagern." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage
      title="Beilagen entkoppeln"
      description="Beilagen-Komponenten werden zu eigenen Rezepten – danach planst du sie separat."
    >
      <SideDishMigrationSection />
    </SettingsSubPage>
  ),
});
