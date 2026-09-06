import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, MoreVertical, Flame, Globe, RefreshCw, EyeOff, ArrowUpDown, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SearchInputWithBeam } from "@/components/SearchInputWithBeam";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { IngredientMasterFormDialog } from "@/components/IngredientMasterFormDialog";
import { IngredientDeleteDialog } from "@/components/IngredientDeleteDialog";
import { IngredientMasterCard } from "@/components/IngredientMasterCard";
import { Switch } from "@/components/ui/switch";
import {
  ingredientsMasterQuery,
  ingredientSearchText,
  matchesViaSubcategory,
  unarchiveIngredientMaster,
  type IngredientMaster,
} from "@/lib/ingredients-master";
import {
  brandsQuery,
  createBrand,
  updateBrand,
  deleteBrand,
  countBrandUsage,
  type Brand,
} from "@/lib/brands";
import { toast } from "sonner";
import { CategoryFilterChips } from "@/components/CategoryFilterChips";
import { IngredientFilterSheet } from "@/components/IngredientFilterSheet";
import {
  activeFilterCount,
  describeRange,
  INGREDIENT_SORT_LABELS,
  matchesNutrientFilters,
  NUTRIENT_FIELDS,
  sortIngredients,
  type IngredientSort,
  type NutrientField,
  type NutrientFilters,
} from "@/lib/ingredient-filters";
import { CommunityTab } from "@/components/CommunityTab";

import {
  findSimilarPublished,
  publishIngredient,
  unpublishIngredient,
} from "@/lib/community";

/** True, wenn eine veröffentlichte Zutat seit dem letzten Publish verändert wurde. */
function hasUnpublishedChanges(m: IngredientMaster): boolean {
  if (!m.is_published || !m.published_at) return false;
  // 1s Toleranz: published_at und updated_at werden im selben Update gesetzt.
  return new Date(m.updated_at).getTime() > new Date(m.published_at).getTime() + 1000;
}

import {
  INGREDIENT_CATEGORIES,
  DEFAULT_INGREDIENT_CATEGORY,
  groupByCategory,
} from "@/lib/categories";


export const Route = createFileRoute("/_authenticated/ingredients")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ingredientsMasterQuery(true));
    context.queryClient.ensureQueryData(brandsQuery());
  },
  component: IngredientsPage,
  pendingComponent: () => (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  ),
});

function IngredientsPage() {
  const [tab, setTab] = useState<"ingredients" | "brands" | "community">("ingredients");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Zutaten</h1>
        <p className="text-sm text-muted-foreground">
          Stammzutaten, Marken und Community-Hub
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid h-auto w-full max-w-sm grid-cols-3 gap-1 rounded-2xl border border-border bg-muted/70 p-1 shadow-inner">
          {(
            [
              ["ingredients", "Zutaten"],
              ["brands", "Marken"],
              ["community", "Community"],
            ] as const
          ).map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-xl py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:[background:var(--primary-gradient)]"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="ingredients" className="mt-4">
          <IngredientsTab />
        </TabsContent>
        <TabsContent value="brands" className="mt-4">
          <BrandsTab />
        </TabsContent>
        <TabsContent value="community" className="mt-4">
          <CommunityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IngredientsTab() {
  const { data: fullList } = useSuspenseQuery(ingredientsMasterQuery(true));
  const { data: brands } = useSuspenseQuery(brandsQuery());
  const [search, setSearch] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<IngredientSort>("name_asc");
  const [nutrientFilters, setNutrientFilters] = useState<NutrientFilters>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IngredientMaster | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<IngredientMaster | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const list = useMemo(
    () => (showArchived ? fullList : fullList.filter((m) => !m.archived)),
    [fullList, showArchived],
  );
  const archivedCount = useMemo(
    () => fullList.filter((m) => m.archived).length,
    [fullList],
  );

  const brandName = (id: string | null) =>
    id ? brands.find((b) => b.id === id)?.name ?? null : null;

  const availableCategories = useMemo(() => {
    const set = new Set<string>(INGREDIENT_CATEGORIES);
    list.forEach((m) => set.add(m.category || DEFAULT_INGREDIENT_CATEGORY));
    return Array.from(set);
  }, [list]);

  const nutrientCount = activeFilterCount(nutrientFilters);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = list.filter((m) => {
      const haystack = `${ingredientSearchText(m)} ${brandName(m.brand_id) ?? ""}`;
      const matchS = !q || haystack.toLowerCase().includes(q);
      const cat = m.category || DEFAULT_INGREDIENT_CATEGORY;
      const matchC = selectedCats.length === 0 || selectedCats.includes(cat);
      return matchS && matchC && matchesNutrientFilters(m, nutrientFilters);
    });
    return sortIngredients(matched, sort);
  }, [list, search, selectedCats, brands, nutrientFilters, sort]);

  const searchActive = search.trim().length > 0;
  const filterActive = selectedCats.length > 0 || nutrientCount > 0;
  const useGrouped = !searchActive && !filterActive && sort === "name_asc";

  const grouped = useMemo(() => {
    if (!useGrouped) return null;
    const g = groupByCategory(
      filtered,
      (m) => m.category || DEFAULT_INGREDIENT_CATEGORY,
    );
    return g.map((section) => ({
      ...section,
      items: [...section.items].sort((a, b) => a.name.localeCompare(b.name, "de")),
    }));
  }, [filtered, useGrouped]);

  function clearNutrient(field: NutrientField) {
    setNutrientFilters((f) => {
      const next = { ...f };
      delete next[field];
      return next;
    });
  }


  function openNew() {
    setEditing(undefined);
    setDialogOpen(true);
  }
  function openEdit(m: IngredientMaster) {
    setEditing(m);
    setDialogOpen(true);
  }
  function openDelete(m: IngredientMaster) {
    setDeleteTarget(m);
    setDeleteOpen(true);
  }

  function toggleCat(c: string) {
    setSelectedCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  }

  function renderRow(m: IngredientMaster) {
    return (
      <IngredientMasterCard
        key={m.id}
        m={m}
        brandName={brandName(m.brand_id)}
        onEdit={openEdit}
        onDelete={openDelete}
      />
    );
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {list.length} Stammzutat{list.length === 1 ? "" : "en"}
          {archivedCount > 0 && !showArchived && (
            <> · {archivedCount} archiviert</>
          )}
        </p>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Zutat
        </Button>
      </div>

      {archivedCount > 0 && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          Archivierte anzeigen
        </label>
      )}

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchInputWithBeam
            placeholder="Zutaten durchsuchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Sortieren"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowUpDown className="h-4 w-4" />
            <span className="hidden sm:inline">Sortieren</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
            {(Object.keys(INGREDIENT_SORT_LABELS) as IngredientSort[]).map((k) => (
              <DropdownMenuItem
                key={k}
                onSelect={() => setSort(k)}
                className={sort === k ? "justify-between font-medium" : "justify-between"}
              >
                {INGREDIENT_SORT_LABELS[k]}
                {sort === k && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <IngredientFilterSheet
          filters={nutrientFilters}
          onApply={setNutrientFilters}
        />
      </div>

      {nutrientCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {NUTRIENT_FIELDS.filter((f) => nutrientFilters[f]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => clearNutrient(f)}
              className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {describeRange(f, nutrientFilters[f]!)}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setNutrientFilters({})}
            className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Alle Filter zurücksetzen
          </button>
        </div>
      )}

      {list.length > 0 && (
        <CategoryFilterChips
          categories={availableCategories}
          selected={selectedCats}
          onToggle={toggleCat}
          onClear={() => setSelectedCats([])}
        />
      )}

      {(searchActive || filterActive) && (
        <p className="text-sm text-muted-foreground">
          {filtered.length} Treffer
        </p>
      )}


      {list.length === 0 ? (
        <EmptyState
          title="Noch keine Zutaten"
          description="Lege deine erste Stammzutat an, um Nährwerte automatisch berechnen zu lassen."
          action={
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Zutat anlegen
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Keine Treffer" description="Passe Suche oder Filter an." />
      ) : useGrouped && grouped ? (
        <div className="space-y-6">
          {grouped.map((section) => (
            <section key={section.category}>
              <div className="sticky top-0 z-10 mb-2 flex items-baseline gap-2 border-b border-border/70 bg-background/95 pb-1.5 backdrop-blur">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {section.category}
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground/70">
                  {section.items.length}
                </span>
              </div>
              <ul className="space-y-2">{section.items.map(renderRow)}</ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map(renderRow)}
        </ul>
      )}

      <IngredientMasterFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={editing}
      />
      <IngredientDeleteDialog
        ingredient={deleteTarget}
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function BrandsTab() {
  const { data: brands } = useSuspenseQuery(brandsQuery());
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | undefined>();
  const [name, setName] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, search]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) return updateBrand(editing.id, name);
      return createBrand(name);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["ingredients_master"] });
      toast.success(editing ? "Marke aktualisiert" : "Marke angelegt");
      setFormOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const usage = await countBrandUsage(id);
      if (usage > 0) {
        throw new Error(
          `Marke wird noch bei ${usage} Zutat${usage === 1 ? "" : "en"} verwendet. Bitte zuerst dort entfernen.`,
        );
      }
      return deleteBrand(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["ingredients_master"] });
      toast.success("Marke gelöscht");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  function openNew() {
    setEditing(undefined);
    setName("");
    setFormOpen(true);
  }
  function openEdit(b: Brand) {
    setEditing(b);
    setName(b.name);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {brands.length} Marke{brands.length === 1 ? "" : "n"}
        </p>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Marke
        </Button>
      </div>

      <SearchInputWithBeam
            placeholder="Marken durchsuchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

      {brands.length === 0 ? (
        <EmptyState
          title="Noch keine Marken"
          description="Lege deine erste Marke an, um Zutaten einer Marke zuzuordnen."
          action={
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Marke anlegen
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Keine Treffer" description="Passe die Suche an." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {filtered.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 px-4 py-3"
              >
                <Link
                  to="/brands/$id"
                  params={{ id: b.id }}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {b.name}
                </Link>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(b)}
                    aria-label="Bearbeiten"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Löschen">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Marke löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          „{b.name}" wird entfernt. Löschen ist nur möglich, wenn keine
                          Zutat mehr diese Marke verwendet.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMut.mutate(b.id)}
                          disabled={deleteMut.isPending}
                        >
                          Löschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Marke bearbeiten" : "Neue Marke"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMut.mutate();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="brand-name">Name *</Label>
              <Input
                id="brand-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                autoFocus
                placeholder="z. B. Alpro, Barilla…"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFormOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending ? "Speichern…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
