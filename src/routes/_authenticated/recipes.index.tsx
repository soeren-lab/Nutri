import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Dices, Heart, LayoutGrid, List, Palette, Plus, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { recipesQuery } from "@/lib/recipes";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipeCardVibrant } from "@/components/RecipeCardVibrant";
import { RecipeListItem } from "@/components/RecipeListItem";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInputWithBeam } from "@/components/SearchInputWithBeam";
import { Button } from "@/components/ui/button";
import { aggregateCategories } from "@/hooks/use-all-categories";
import { getCategoryColor } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { SortDropdown } from "@/components/SortDropdown";
import { useRecipeFilters } from "@/hooks/use-recipe-filters";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CookbooksTab } from "@/components/CookbooksTab";
import { RandomRecipeDialog } from "@/components/RandomRecipeDialog";
import { SegmentedTabsList } from "@/components/SegmentedTabsList";
import { useSwipePriority } from "@/hooks/use-swipe-priority";

const RECIPE_TABS = ["mine", "cookbooks"] as const;
type RecipeTab = (typeof RECIPE_TABS)[number];

export const Route = createFileRoute("/_authenticated/recipes/")({
  validateSearch: (search: Record<string, unknown>): { tab?: RecipeTab } => {
    const tab = search["tab"];
    return tab === "mine" || tab === "cookbooks" ? { tab } : {};
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(recipesQuery());
  },
  component: RecipesPage,
  pendingComponent: RecipesSkeleton,
});

function RecipesPage() {
  const { data: recipes } = useSuspenseQuery(recipesQuery());
  const [randomOpen, setRandomOpen] = useState(false);
  const {
    search,
    setSearch,
    selectedCategories,
    setSelectedCategories,
    toggleCategory,
    favOnly,
    setFavOnly,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    filtered,
    favSet,
  } = useRecipeFilters(recipes);

  const availableCategories = useMemo(() => aggregateCategories(recipes), [recipes]);

  // Sub-Tab-Auswahl steckt in der URL (?tab=mine|cookbooks) statt in lokalem
  // State – dadurch führt sowohl ein Deep-Link als auch die Swipe-back-Geste
  // aus einem Kochbuch/Rezept zurück zum korrekten Sub-Tab, statt ihn zu
  // verlieren (siehe cookbooks.$id.index.tsx, CookbookForm.tsx).
  const { tab: tabParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = tabParam ?? "mine";
  const setTab = (next: RecipeTab) => navigate({ search: { tab: next }, replace: true });
  const tabIndex = RECIPE_TABS.indexOf(tab);
  useSwipePriority({
    onSwipeLeft: () => setTab(RECIPE_TABS[Math.min(tabIndex + 1, RECIPE_TABS.length - 1)]!),
    onSwipeRight: () => setTab(RECIPE_TABS[Math.max(tabIndex - 1, 0)]!),
  });

  return (
    // "liquid-glass"/"refract-test": Rollout des im Planer erprobten
    // Liquid-Glass-Looks (siehe styles.css) – bewusst nur auf dieser
    // Übersichtsseite, nicht auf Detail-/Bearbeiten-Routen (eigene Dateien,
    // erben die Klasse nicht automatisch).
    <div className="liquid-glass refract-test space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as RecipeTab)} className="space-y-6">
        <SegmentedTabsList
          tabs={
            [
              ["mine", "Meine"],
              ["cookbooks", "Kochbücher"],
            ] as const
          }
        />

        <TabsContent value="cookbooks" className="space-y-4">
          <CookbooksTab />
        </TabsContent>

        <TabsContent value="mine" className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {filtered.length} Rezept{filtered.length === 1 ? "" : "e"}
              </p>
              <Button asChild className="gap-1.5">
                <Link to="/recipes/new">
                  <Plus className="h-4 w-4" /> Rezept
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <SearchInputWithBeam
                placeholder="Rezepte durchsuchen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                containerClassName="flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Filter & Ansicht">
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 space-y-3">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Sortierung</p>
                    <SortDropdown value={sortBy} onChange={setSortBy} />
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Ansicht</p>
                    <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                      <button
                        type="button"
                        onClick={() => setViewMode("grid")}
                        aria-label="Rasteransicht"
                        aria-pressed={viewMode === "grid"}
                        className={cn(
                          "flex h-8 flex-1 items-center justify-center rounded transition-colors",
                          viewMode === "grid"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("list")}
                        aria-label="Listenansicht"
                        aria-pressed={viewMode === "list"}
                        className={cn(
                          "flex h-8 flex-1 items-center justify-center rounded transition-colors",
                          viewMode === "list"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <List className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("vibrant")}
                        aria-label="Bunte Kartenansicht"
                        aria-pressed={viewMode === "vibrant"}
                        className={cn(
                          "flex h-8 flex-1 items-center justify-center rounded transition-colors",
                          viewMode === "vibrant"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Palette className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => setRandomOpen(true)}
                    disabled={recipes.length === 0}
                  >
                    <Dices className="h-4 w-4" /> Zufälliges Rezept
                  </Button>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategories([])}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  selectedCategories.length === 0
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                Alle
              </button>
              <button
                type="button"
                onClick={() => setFavOnly(!favOnly)}
                aria-pressed={favOnly}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  favOnly
                    ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <Heart className={cn("h-3 w-3", favOnly && "fill-current")} />
                Favoriten
              </button>
              {availableCategories.map((c) => {
                const color = getCategoryColor(c);
                const active = selectedCategories.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                      active
                        ? cn(color.bg, color.text, color.border)
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {recipes.length === 0 ? (
            <EmptyState
              title="Noch keine Rezepte"
              description="Lege dein erstes Rezept an und beginne deine Sammlung."
              action={
                <Button asChild>
                  <Link to="/recipes/new">
                    <Plus className="mr-2 h-4 w-4" /> Rezept erstellen
                  </Link>
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={favOnly ? "Keine Favoriten" : "Keine Treffer"}
              description={
                favOnly
                  ? "Markiere Rezepte mit dem Herz, um sie hier zu sehen."
                  : "Passe Suche oder Filter an."
              }
            />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((r) => (
                <RecipeCard key={r.id} recipe={r} />
              ))}
            </div>
          ) : viewMode === "vibrant" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => (
                <RecipeCardVibrant key={r.id} recipe={r} isFavorite={favSet.has(r.id)} />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {filtered.map((r) => (
                <div key={r.id} className="px-3">
                  <RecipeListItem recipe={r} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RandomRecipeDialog open={randomOpen} onOpenChange={setRandomOpen} />
    </div>
  );
}

function RecipesSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-52" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
