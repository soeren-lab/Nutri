import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { RecipeCommunityTab } from "@/components/RecipeCommunityTab";
import { CommunityTab } from "@/components/CommunityTab";
import { SegmentedTabsList } from "@/components/SegmentedTabsList";
import { useSwipePriority } from "@/hooks/use-swipe-priority";

const DISCOVER_TABS = ["recipes", "ingredients"] as const;
type DiscoverTab = (typeof DISCOVER_TABS)[number];

/**
 * Community-Bereich: alles, was Internet braucht (im Gegensatz zu
 * Rezepte/Zutaten/Kochbücher/Planer, die offline voll nutzbar sind).
 */
export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({
    meta: [
      { title: "Entdecken – Community-Rezepte und -Zutaten" },
      {
        name: "description",
        content: "Von anderen veröffentlichte Rezepte und Zutaten entdecken und übernehmen.",
      },
      { property: "og:title", content: "Entdecken" },
      { property: "og:description", content: "Community-Rezepte und -Zutaten durchsuchen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const [tab, setTab] = useState<DiscoverTab>("recipes");
  const tabIndex = DISCOVER_TABS.indexOf(tab);
  useSwipePriority({
    onSwipeLeft: () => setTab(DISCOVER_TABS[Math.min(tabIndex + 1, DISCOVER_TABS.length - 1)]!),
    onSwipeRight: () => setTab(DISCOVER_TABS[Math.max(tabIndex - 1, 0)]!),
  });

  return (
    <div className="liquid-glass refract-test space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as DiscoverTab)} className="space-y-4">
        <SegmentedTabsList
          tabs={
            [
              ["recipes", "Rezepte"],
              ["ingredients", "Zutaten"],
            ] as const
          }
        />

        <TabsContent value="recipes" className="space-y-4">
          <RecipeCommunityTab />
        </TabsContent>
        <TabsContent value="ingredients" className="space-y-4">
          <CommunityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
