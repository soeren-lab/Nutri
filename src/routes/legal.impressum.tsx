import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, OpenFoodFactsAttribution } from "@/components/LegalPage";

export const Route = createFileRoute("/legal/impressum")({
  head: () => ({
    meta: [
      { title: "Impressum – Nomora" },
      { name: "description", content: "Anbieterkennzeichnung und Kontakt zu Nomora." },
      { property: "og:title", content: "Impressum – Nomora" },
      { property: "og:description", content: "Anbieterkennzeichnung von Nomora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Impressum">
      <OpenFoodFactsAttribution />
    </LegalPage>
  ),
});

