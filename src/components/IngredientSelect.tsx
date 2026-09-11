import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchSheet, SearchSheetRow } from "@/components/SearchSheet";
import { useIngredientsMaster } from "@/hooks/use-ingredients-master";
import { useBrands } from "@/hooks/use-brands";
import {
  ingredientSearchText,
  matchesViaSubcategory,
  type IngredientMaster,
} from "@/lib/ingredients-master";
import { IngredientMasterFormDialog } from "@/components/IngredientMasterFormDialog";
import { IngredientSortFilterBar } from "@/components/IngredientSortFilterBar";
import { CommunityResultsSection } from "@/components/CommunityResultsSection";
import { OffResultsSection } from "@/components/OffResultsSection";
import {
  INGREDIENT_CATEGORIES,
  DEFAULT_INGREDIENT_CATEGORY,
} from "@/lib/categories";
import {
  matchesNutrientFilters,
  sortIngredients,
  type IngredientSort,
  type NutrientFilters,
} from "@/lib/ingredient-filters";
import { cn } from "@/lib/utils";

export function IngredientSelect({
  name,
  masterId,
  onSelectMaster,
  onNameChange,
  onClearMaster,
}: {
  name: string;
  masterId: string | null;
  onSelectMaster: (master: IngredientMaster) => void;
  onNameChange: (name: string) => void;
  onClearMaster: () => void;
}) {
  const list = useIngredientsMaster();
  const brands = useBrands();
  const brandName = (id: string | null) =>
    id ? brands.find((b) => b.id === id)?.name ?? null : null;
  const [open, setOpen] = useState(false);
  const [createDefault, setCreateDefault] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [sort, setSort] = useState<IngredientSort>("name_asc");
  const [nutrientFilters, setNutrientFilters] = useState<NutrientFilters>({});
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  const selected = masterId ? list.find((m) => m.id === masterId) ?? null : null;

  const availableCategories = useMemo(() => {
    const set = new Set<string>(INGREDIENT_CATEGORIES);
    list.forEach((m) => set.add(m.category || DEFAULT_INGREDIENT_CATEGORY));
    return Array.from(set);
  }, [list]);

  /** Gleiche Filter-/Sortierlogik wie im Zutaten-Tab. */
  const items = useMemo(() => {
    const matched = list.filter((m) => {
      const cat = m.category || DEFAULT_INGREDIENT_CATEGORY;
      const matchC = selectedCats.length === 0 || selectedCats.includes(cat);
      return matchC && matchesNutrientFilters(m, nutrientFilters);
    });
    return sortIngredients(matched, sort);
  }, [list, selectedCats, nutrientFilters, sort]);

  const getSearchText = (m: IngredientMaster) => ingredientSearchText(m, brandName);
  function pickAndClose(m: IngredientMaster) {
    onSelectMaster(m);
    setOpen(false);
  }

  function acceptFreetext(q: string) {
    onNameChange(q);
    onClearMaster();
    setOpen(false);
  }

  function openCreate(q: string) {
    setCreateDefault(q);
    setOpen(false);
    setShowCreate(true);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full justify-between font-normal",
          !selected && !name && "text-muted-foreground",
        )}
      >
        <span className="truncate">
          {selected ? selected.name : name || "Zutat wählen oder eintippen…"}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <SearchSheet
        open={open}
        onOpenChange={setOpen}
        title="Zutat wählen"
        placeholder="Zutat suchen oder eintippen…"
        items={items}
        toolbar={
          <IngredientSortFilterBar
            sort={sort}
            onSortChange={setSort}
            filters={nutrientFilters}
            onFiltersChange={setNutrientFilters}
            categories={availableCategories}
            selectedCategories={selectedCats}
            onToggleCategory={(c) =>
              setSelectedCats((s) =>
                s.includes(c) ? s.filter((x) => x !== c) : [...s, c],
              )
            }
            onClearCategories={() => setSelectedCats([])}
            compact
          />
        }
        getSearchText={getSearchText}
        selectedId={masterId}
        onSelect={(m) => onSelectMaster(m)}
        emptyLabel="Keine Zutaten für diese Filter"
        onCreate={(q) => openCreate(q)}
        createLabel={(q) => <>„{q}" als neue Zutat anlegen</>}
        renderAfterList={(query) => {
          const hasLocalMatch = items.some((m) =>
            getSearchText(m).toLowerCase().includes(query.toLowerCase()),
          );
          if (hasLocalMatch) return null;
          return (
            <>
              <CommunityResultsSection query={query} onImported={pickAndClose} />
              <OffResultsSection variant="rows" query={query} onImported={pickAndClose} />
            </>
          );
        }}
        renderQueryExtras={(q) => (
          <SearchSheetRow onClick={() => acceptFreetext(q)}>
            <PenLine className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">„{q}" als Freitext übernehmen</span>
          </SearchSheetRow>
        )}
        renderItem={(m, { selected, onSelect, query }) => {
          const brand = brandName(m.brand_id);
          const hint = m.subcategory && matchesViaSubcategory(m, query ?? "") ? m.subcategory : null;
          return (
            <SearchSheetRow onClick={onSelect} selected={selected}>
              <Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  selected ? "opacity-100 text-primary" : "opacity-0",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{m.name}</span>
                {(brand || hint) && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {brand && <span className="font-medium text-foreground">{brand}</span>}
                    {brand && hint && " · "}
                    {hint}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {m.calories != null
                  ? `${m.calories} kcal / ${m.unit === "Stk" || m.unit === "Stück" ? "Stück" : `100${m.unit}`}`
                  : "keine Nährwerte"}
              </span>
            </SearchSheetRow>
          );
        }}
      />

      <IngredientMasterFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        defaultName={createDefault || name}
        onSaved={(m) => {
          onSelectMaster(m);
          setCreateDefault("");
        }}
      />
    </>
  );
}
