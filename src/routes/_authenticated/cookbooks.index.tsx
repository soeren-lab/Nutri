import { createFileRoute } from "@tanstack/react-router";
import { cookbooksQuery } from "@/lib/cookbooks";
import { CookbooksTab } from "@/components/CookbooksTab";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassScreenHeader } from "@/components/GlassScreenHeader";

/**
 * Eigenständige Kochbücher-Seite – nicht mehr in der Bottom-Nav (Kochbücher
 * lebt jetzt als Unter-Tab unter Rezepte), bleibt aber für Deep-Links und
 * "Zurück"-Navigation aus Kochbuch-Detail/-Formular erreichbar.
 */
export const Route = createFileRoute("/_authenticated/cookbooks/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(cookbooksQuery());
  },
  component: CookbooksPage,
  pendingComponent: () => (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  ),
});

function CookbooksPage() {
  return (
    <div className="space-y-6">
      <GlassScreenHeader title="Kochbücher" />
      <CookbooksTab />
    </div>
  );
}
