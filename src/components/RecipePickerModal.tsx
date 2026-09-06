import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchSheet, SearchSheetRow } from "@/components/SearchSheet";
import { recipesQuery } from "@/lib/recipes";
import { useSignedImage } from "@/hooks/use-signed-image";
import type { Recipe } from "@/types/recipe";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: string[];
  onConfirm: (recipeIds: string[]) => void | Promise<void>;
  submitting?: boolean;
};

export function RecipePickerModal({
  open,
  onOpenChange,
  excludeIds,
  onConfirm,
  submitting,
}: Props) {
  const { data: recipes = [] } = useQuery({ ...recipesQuery(), enabled: open });
  const [selected, setSelected] = useState<string[]>([]);

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);
  const items = useMemo(
    () => recipes.filter((r) => !excludeSet.has(r.id)),
    [recipes, excludeSet],
  );

  function handleOpenChange(v: boolean) {
    if (!v) setSelected([]);
    onOpenChange(v);
  }

  async function handleConfirm() {
    if (selected.length === 0) return;
    await onConfirm(selected);
    setSelected([]);
  }

  return (
    <SearchSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Rezepte hinzufügen"
      placeholder="Rezepte durchsuchen…"
      items={items}
      getSearchText={(r) => r.title}
      selectedIds={selected}
      onToggle={(r) =>
        setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))
      }
      emptyLabel={recipes.length === 0 ? "Keine Rezepte vorhanden" : "Keine Treffer"}
      renderItem={(r, { selected: sel, onSelect }) => (
        <PickerRow recipe={r} selected={sel} onToggle={onSelect} />
      )}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {selected.length} ausgewählt
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleConfirm} disabled={selected.length === 0 || submitting}>
              Hinzufügen
            </Button>
          </div>
        </div>
      }
    />
  );
}

function PickerRow({
  recipe,
  selected,
  onToggle,
}: {
  recipe: Recipe;
  selected: boolean;
  onToggle: () => void;
}) {
  const { data: imageUrl } = useSignedImage(recipe.image_url);
  return (
    <SearchSheetRow onClick={onToggle} selected={selected}>
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
        )}
      >
        {selected && <Check className="h-3.5 w-3.5" />}
      </div>
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
          </div>
        )}
      </div>
      <span className="line-clamp-2 flex-1 text-sm font-medium">{recipe.title}</span>
    </SearchSheetRow>
  );
}
