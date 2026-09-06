import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { SearchSheet, SearchSheetRow } from "@/components/SearchSheet";
import { recipesQuery } from "@/lib/recipes";
import type { RecipeListItem } from "@/types/recipe";

/**
 * SearchSheet-Variante zur Auswahl eines Rezepts als Sub-Rezept.
 * Das aktuelle Rezept wird ausgeschlossen.
 */
export function RecipeLinkPicker({
  open,
  onOpenChange,
  excludeRecipeId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeRecipeId?: string | null;
  onSelect: (recipe: RecipeListItem) => void | Promise<void>;
}) {
  const { data: recipes = [] } = useQuery({ ...recipesQuery(), enabled: open });
  const items = recipes.filter((r) => r.id !== excludeRecipeId);

  return (
    <SearchSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Rezept verlinken"
      placeholder="Rezept suchen…"
      items={items}
      getSearchText={(r) => r.title}
      emptyLabel="Keine Rezepte vorhanden"
      onSelect={(r) => void onSelect(r)}
      renderItem={(r, ctx) => (
        <SearchSheetRow onClick={ctx.onSelect} selected={ctx.selected}>
          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{r.title}</span>
            {r.servings != null && (
              <span className="block text-xs text-muted-foreground">
                {r.servings} {r.servings === 1 ? "Portion" : "Portionen"}
              </span>
            )}
          </span>
        </SearchSheetRow>
      )}
    />
  );
}

/** Kleiner Wrapper mit eigenem Trigger-State. */
export function useRecipeLinkPicker() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
