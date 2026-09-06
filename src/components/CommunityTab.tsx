import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpDown, Loader2, Users, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SearchInputWithBeam } from "@/components/SearchInputWithBeam";
import { EmptyState } from "@/components/EmptyState";
import { CategoryFilterChips } from "@/components/CategoryFilterChips";
import { IngredientMasterCard } from "@/components/IngredientMasterCard";
import { IngredientMasterFormDialog } from "@/components/IngredientMasterFormDialog";
import { IngredientDeleteDialog } from "@/components/IngredientDeleteDialog";
import { IngredientFilterSheet } from "@/components/IngredientFilterSheet";
import { OffResultsSection } from "@/components/OffResultsSection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  communityIngredientsQuery,
  importCommunityIngredient,
  type CommunityIngredient,
} from "@/lib/community";
import { ingredientsMasterQuery, type IngredientMaster } from "@/lib/ingredients-master";
import {
  DEFAULT_INGREDIENT_CATEGORY,
  INGREDIENT_CATEGORIES,
} from "@/lib/categories";
import { toast } from "sonner";

export function CommunityTab() {
  const { user } = useAuth();
  const uid = user?.id;
  const { data: own } = useSuspenseQuery(ingredientsMasterQuery(true));
  const { data: list = [], isLoading } = useQuery(communityIngredientsQuery());
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [sort, setSort] = useState<IngredientSort>("name_asc");
  const [nutrientFilters, setNutrientFilters] = useState<NutrientFilters>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<IngredientMaster | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IngredientMaster | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const importedSourceIds = useMemo(
    () => new Set(own.map((m) => m.source_ingredient_id).filter(Boolean) as string[]),
    [own],
  );

  const importMut = useMutation({
    mutationFn: (src: CommunityIngredient) => importCommunityIngredient(src),
    onMutate: (src) => setPendingId(src.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients_master"] });
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["ingredient_updates"] });
      toast.success("Zutat hinzugefügt");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
    onSettled: () => setPendingId(null),
  });

  const availableCategories = useMemo(() => {
    const set = new Set<string>(INGREDIENT_CATEGORIES);
    list.forEach((m) => set.add(m.category || DEFAULT_INGREDIENT_CATEGORY));
    return Array.from(set);
  }, [list]);

  const nutrientCount = activeFilterCount(nutrientFilters);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = list.filter((m) => {
      const matchS =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.brand?.name ?? "").toLowerCase().includes(q) ||
        (m.author_username ?? "").toLowerCase().includes(q);
      const cat = m.category || DEFAULT_INGREDIENT_CATEGORY;
      const matchC = selectedCats.length === 0 || selectedCats.includes(cat);
      return matchS && matchC && matchesNutrientFilters(m, nutrientFilters);
    });
    return sortIngredients(matched, sort) as CommunityIngredient[];
  }, [list, search, selectedCats, nutrientFilters, sort]);

  function toggleCat(c: string) {
    setSelectedCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  }

  function clearNutrient(field: NutrientField) {
    setNutrientFilters((f) => {
      const next = { ...f };
      delete next[field];
      return next;
    });
  }

  const searchActive = search.trim().length > 0;
  const filterActive = selectedCats.length > 0 || nutrientCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        Community · Zutaten
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchInputWithBeam
            placeholder="Community durchsuchen…"
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
              <DropdownMenuItem key={k} onClick={() => setSort(k)}>
                {INGREDIENT_SORT_LABELS[k]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <IngredientFilterSheet filters={nutrientFilters} onApply={setNutrientFilters} />
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
          compact
          categories={availableCategories}
          selected={selectedCats}
          onToggle={toggleCat}
          onClear={() => setSelectedCats([])}
        />
      )}

      {(searchActive || filterActive) && (
        <p className="text-sm text-muted-foreground">{filtered.length} Treffer</p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        searchActive ? (
          <ul className="space-y-2">
            <OffResultsSection query={search} variant="cards" />
          </ul>
        ) : (
          <EmptyState
            title="Noch nichts im Hub"
            description="Veröffentliche eigene Zutaten, damit andere sie nutzen können."
          />
        )
      ) : filtered.length === 0 ? (
        searchActive ? (
          <ul className="space-y-2">
            <OffResultsSection query={search} variant="cards" />
          </ul>
        ) : (
          <EmptyState title="Keine Treffer" description="Passe Suche oder Filter an." />
        )
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => {
            const isOwn = uid != null && m.user_id === uid;
            return (
              <IngredientMasterCard
                key={m.id}
                m={m}
                brandName={m.brand?.name ?? null}
                onEdit={(x) => {
                  setEditing(x);
                  setDialogOpen(true);
                }}
                onDelete={(x) => {
                  setDeleteTarget(x);
                  setDeleteOpen(true);
                }}
                community={{
                  authorLabel: isOwn ? "du" : `@${m.author_username ?? "unbekannt"}`,
                  isOwn,
                  added: importedSourceIds.has(m.id),
                  adding: pendingId === m.id,
                  onAdd: () => importMut.mutate(m),
                }}
              />
            );
          })}
          {searchActive && <OffResultsSection query={search} variant="cards" />}
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
