import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dices, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { recipesQuery } from "@/lib/recipes";
import { useQuery } from "@tanstack/react-query";
import { useSwipePriority } from "@/hooks/use-swipe-priority";
import { recipeCategoriesOf } from "@/hooks/use-all-categories";
import { getCategoryColor } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { RecipeListItem } from "@/types/recipe";

export function RandomRecipeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: recipes = [] } = useQuery({ ...recipesQuery(), enabled: open });
  const [category, setCategory] = useState<string | null>(null);
  const navigate = useNavigate();

  const categories = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => recipeCategoriesOf(r).forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [recipes]);

  const pool = useMemo(() => {
    if (!category) return recipes;
    return recipes.filter((r) => recipeCategoriesOf(r).includes(category));
  }, [recipes, category]);

  function pickRandom() {
    if (pool.length === 0) return;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    onOpenChange(false);
    setCategory(null);
    navigate({ to: "/recipes/$id", params: { id: choice.id } });
  }

  useSwipePriority(
    open
      ? { onSwipeLeft: () => onOpenChange(false), onSwipeRight: () => onOpenChange(false) }
      : null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dices className="h-5 w-5 text-primary" />
            Zufälliges Rezept
          </DialogTitle>
          <DialogDescription>
            Wähle eine Kategorie – oder starte direkt mit „Überrasch mich".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                category === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Alle
            </button>
            {categories.map((c) => {
              const color = getCategoryColor(c);
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
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
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground">Keine Kategorien vorhanden.</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {pool.length} Rezept{pool.length === 1 ? "" : "e"} zur Auswahl
            {category ? ` in „${category}"` : ""}.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={pickRandom} disabled={pool.length === 0}>
            <Sparkles className="mr-2 h-4 w-4" />
            {category ? "Zufällig wählen" : "Überrasch mich"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Trigger-Button für den Zufallsmodus. */
export function RandomRecipeButton({
  recipes,
  onPick,
}: {
  recipes: RecipeListItem[];
  onPick?: () => void;
}) {
  // Nur anzeigen, wenn überhaupt Rezepte vorhanden sind.
  if (recipes.length === 0) return null;
  return (
    <Button variant="outline" size="icon" aria-label="Zufälliges Rezept" onClick={onPick}>
      <Dices className="h-4 w-4" />
    </Button>
  );
}
