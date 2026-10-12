import { createFileRoute } from "@tanstack/react-router";
import { LiquidGlassAppearanceSection } from "@/components/LiquidGlassAppearanceSection";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/appearance")({
  head: () => ({
    meta: [
      { title: "Darstellung – Liquid Glass Hell oder Dunkel" },
      {
        name: "description",
        content: "Wähle die Liquid-Glass-Farbvariante: Hell oder Dunkel.",
      },
      { property: "og:title", content: "Darstellung" },
      { property: "og:description", content: "Liquid Glass Hell oder Dunkel auswählen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="Darstellung">
      <LiquidGlassAppearanceSection />
    </SettingsSubPage>
  ),
});
