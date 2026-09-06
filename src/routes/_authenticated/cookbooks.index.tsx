import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { cookbooksQuery } from "@/lib/cookbooks";
import { CookbookCard } from "@/components/CookbookCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

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
  const { data: cookbooks } = useSuspenseQuery(cookbooksQuery());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kochbücher</h1>
          <p className="text-sm text-muted-foreground">
            {cookbooks.length} Kochbuch{cookbooks.length === 1 ? "" : "ücher"} in deiner Sammlung
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link to="/cookbooks/new">
            <Plus className="h-4 w-4" /> Kochbuch
          </Link>
        </Button>
      </div>

      {cookbooks.length === 0 ? (
        <EmptyState
          title="Noch keine Kochbücher"
          description="Sammle deine Lieblingsrezepte in Kochbüchern und teile sie mit anderen."
          action={
            <Button asChild>
              <Link to="/cookbooks/new">
                <Plus className="mr-2 h-4 w-4" /> Kochbuch erstellen
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {cookbooks.map((c) => (
            <CookbookCard key={c.id} cookbook={c} />
          ))}
        </div>
      )}
    </div>
  );
}
