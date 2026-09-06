import { ArrowUpDown, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IngredientFilterSheet } from "@/components/IngredientFilterSheet";
import { CategoryFilterChips } from "@/components/CategoryFilterChips";
import {
  activeFilterCount,
  describeRange,
  INGREDIENT_SORT_LABELS,
  NUTRIENT_FIELDS,
  type IngredientSort,
  type NutrientField,
  type NutrientFilters,
} from "@/lib/ingredient-filters";
import { cn } from "@/lib/utils";

/**
 * Gemeinsame Sortier-/Filter-Leiste für Zutatenlisten (Zutaten-Tab und
 * "Zutat wählen"-Dialog). Kompakte Variante für den Dialog-Kontext.
 */
export function IngredientSortFilterBar({
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  categories,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  compact = false,
  className,
}: {
  sort: IngredientSort;
  onSortChange: (s: IngredientSort) => void;
  filters: NutrientFilters;
  onFiltersChange: (f: NutrientFilters) => void;
  categories: readonly string[];
  selectedCategories: string[];
  onToggleCategory: (c: string) => void;
  onClearCategories: () => void;
  compact?: boolean;
  className?: string;
}) {
  const nutrientCount = activeFilterCount(filters);

  function clearNutrient(field: NutrientField) {
    const next = { ...filters };
    delete next[field];
    onFiltersChange(next);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <CategoryFilterChips
            categories={categories}
            selected={selectedCategories}
            onToggle={onToggleCategory}
            onClear={onClearCategories}
            compact={compact}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Sortieren"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowUpDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
            {(Object.keys(INGREDIENT_SORT_LABELS) as IngredientSort[]).map((k) => (
              <DropdownMenuItem
                key={k}
                onSelect={() => onSortChange(k)}
                className={cn("justify-between", sort === k && "font-medium")}
              >
                {INGREDIENT_SORT_LABELS[k]}
                {sort === k && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <IngredientFilterSheet filters={filters} onApply={onFiltersChange} />
      </div>

      {nutrientCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {NUTRIENT_FIELDS.filter((f) => filters[f]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => clearNutrient(f)}
              className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-[1px] text-[11px] font-medium text-primary"
            >
              {describeRange(f, filters[f]!)}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => onFiltersChange({})}
            className="rounded-full border border-border px-2 py-[1px] text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}
