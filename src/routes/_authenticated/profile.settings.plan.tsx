import { createFileRoute } from "@tanstack/react-router";
import { BillingPanel } from "@/components/AccountSection";
import { PlanOptions } from "@/components/PlanOptions";
import { usePlan } from "@/hooks/use-plan";
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
  component: PlanPage,
});

function PlanPage() {
  const { plan } = usePlan();
  return (
    <SettingsSubPage title="Mein Plan">
      <PlanOptions />
      {plan !== "free" && <BillingPanel />}
    </SettingsSubPage>
  );
}
