import { createFileRoute } from "@tanstack/react-router";
import { ExperimentalSettingsSection } from "@/components/ExperimentalSettingsSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/experimental")({
  head: () => ({
    meta: [
      { title: "Experimental – Neue Glass-Oberfläche" },
      {
        name: "description",
        content: "Experimentelle Glass-Oberfläche für die App aktivieren.",
      },
      { property: "og:title", content: "Experimental" },
      { property: "og:description", content: "Neue Glass-Oberfläche aktivieren." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="Experimental">
      <ExperimentalSettingsSection />
    </SettingsSubPage>
  ),
});
