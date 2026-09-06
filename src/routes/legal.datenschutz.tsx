import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/legal/datenschutz")({
  head: () => ({
    meta: [
      { title: "Datenschutzerklärung – Nomora" },
      {
        name: "description",
        content:
          "Informationen zum Umgang mit personenbezogenen Daten in Nomora.",
      },
      { property: "og:title", content: "Datenschutzerklärung – Nomora" },
      {
        property: "og:description",
        content: "Umgang mit personenbezogenen Daten in Nomora.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage title="Datenschutzerklärung" />,
});
