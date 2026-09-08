import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { cookbooksQuery } from "@/lib/cookbooks";
import { CookbookCard } from "@/components/CookbookCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

/** Kochbücher-Übersicht – als eigene Seite (`/cookbooks`) und als Unter-Tab von Rezepte nutzbar. */
export function CookbooksTab() {
  const { data: cookbooks } = useSuspenseQuery(cookbooksQuery());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {cookbooks.length} Kochbuch{cookbooks.length === 1 ? "" : "ücher"}
        </p>
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
