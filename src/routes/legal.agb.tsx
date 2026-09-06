import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/legal/agb")({
  head: () => ({
    meta: [
      { title: "Nutzungsbedingungen (AGB) – Nomora" },
      {
        name: "description",
        content: "Nutzungsbedingungen und allgemeine Geschäftsbedingungen von Nomora.",
      },
      { property: "og:title", content: "Nutzungsbedingungen (AGB) – Nomora" },
      {
        property: "og:description",
        content: "Allgemeine Geschäftsbedingungen von Nomora.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage title="Nutzungsbedingungen (AGB)" />,
});
