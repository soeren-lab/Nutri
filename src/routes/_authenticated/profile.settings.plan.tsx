import { createFileRoute } from "@tanstack/react-router";
import { BillingPanel } from "@/components/AccountSection";
import { PlanOptions } from "@/components/PlanOptions";
import { CURRENT_PLAN } from "@/lib/plans";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_authenticated/profile/settings/plan")({
  head: () => ({
    meta: [
      { title: "Mein Plan – Free, Pro & Max" },
      {
        name: "description",
        content: "Plan-Stufen Free, Pro und Max vergleichen und upgraden.",
      },
      { property: "og:title", content: "Mein Plan" },
      { property: "og:description", content: "Free, Pro und Max vergleichen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SettingsSubPage title="Mein Plan">
      <PlanOptions />
      {CURRENT_PLAN !== "free" && <BillingPanel />}
    </SettingsSubPage>
  ),
});
