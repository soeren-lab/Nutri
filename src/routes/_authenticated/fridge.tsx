import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { FridgeView } from "@/components/FridgeView";
import { SegmentedTabsList } from "@/components/SegmentedTabsList";
import { ShoppingListView } from "@/components/ShoppingListView";
import { useSwipePriority } from "@/hooks/use-swipe-priority";

const FRIDGE_TABS = ["fridge", "shopping"] as const;
type FridgeTab = (typeof FRIDGE_TABS)[number];

export const Route = createFileRoute("/_authenticated/fridge")({
  head: () => ({
    meta: [
      { title: "Kühlschrank – Rezeptbuch" },
      {
        name: "description",
        content:
          "Digitaler Kühlschrank: Einkäufe per Barcode oder Schnellauswahl einlagern, Haltbarkeit im Blick behalten. Dazu die Einkaufsliste.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { tab?: FridgeTab } => {
    const tab = search["tab"];
    return tab === "fridge" || tab === "shopping" ? { tab } : {};
  },
  component: FridgePage,
});

function FridgePage() {
  // Unter-Tab steckt in der URL (?tab=fridge|shopping), wie bei Rezepte/Kochbücher.
  const { tab: tabParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = tabParam ?? "fridge";
  const setTab = (next: FridgeTab) => navigate({ search: { tab: next }, replace: true });
  const tabIndex = FRIDGE_TABS.indexOf(tab);
  useSwipePriority({
    onSwipeLeft: () => setTab(FRIDGE_TABS[Math.min(tabIndex + 1, FRIDGE_TABS.length - 1)]!),
    onSwipeRight: () => setTab(FRIDGE_TABS[Math.max(tabIndex - 1, 0)]!),
  });

  return (
    <div className="liquid-glass refract-test space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as FridgeTab)} className="space-y-6">
        <SegmentedTabsList
          tabs={
            [
              ["fridge", "Kühlschrank"],
              ["shopping", "Einkauf"],
            ] as const
          }
        />
        <TabsContent value="fridge">
          <FridgeView />
        </TabsContent>
        <TabsContent value="shopping">
          <ShoppingListView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
