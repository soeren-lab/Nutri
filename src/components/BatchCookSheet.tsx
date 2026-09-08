import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, CookingPot, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useSwipePriority } from "@/hooks/use-swipe-priority";
import { recipeQuery } from "@/lib/recipes";
import { scaleIngredientList, type ScaledIngredient } from "@/hooks/use-scaled-ingredients";
import { freeIngredients } from "@/lib/componentNutrition";
import { applyGroupChoices } from "@/lib/productGroups";
import { parseGroupChoices } from "@/lib/meal-plan";
import { parseVariantSelection } from "@/lib/variants";
import { useIngredientsMaster } from "@/hooks/use-ingredients-master";
import {
  componentBaseServings,
  componentIngredients,
  positiveServings,
} from "@/lib/portionScaling";
import { setBatchCooked, type BatchCookSummary } from "@/lib/batch";
import type { RecipeComponentWithRelations } from "@/types/recipe";

function IngredientRows({ rows }: { rows: ScaledIngredient[] }) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">Keine Zutaten hinterlegt</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((ing) => (
        <li
          key={ing.id}
          className="flex justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0"
        >
          <span className="min-w-0">{ing.name}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {ing.displayAmount} {ing.unit ?? ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Koch-Ansicht für einen Koch-Tag: Zutaten für die gesamte Charge,
 * Zubereitungsschritte und „Fertig / Gekocht“-Häkchen.
 */
export function BatchCookSheet({
  summary,
  onClose,
}: {
  summary: BatchCookSummary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const masters = useIngredientsMaster();
  const { data: rawRecipe, isPending } = useQuery({
    ...recipeQuery(summary.recipeId ?? ""),
    enabled: !!summary.recipeId,
  });

  const selection = useMemo(
    () => parseVariantSelection(summary.selectedVariantIds),
    [summary.selectedVariantIds],
  );
  const choices = useMemo(() => parseGroupChoices(summary.groupChoices), [summary.groupChoices]);

  const recipe = useMemo(
    () => (rawRecipe ? applyGroupChoices(rawRecipe, choices, masters) : null),
    [rawRecipe, choices, masters],
  );

  // Freie Zutaten skalieren über die Gesamt-Portionen des Rezepts.
  const freeFactor = recipe ? summary.totalServings / positiveServings(recipe.servings) : 1;

  const freeRows = useMemo(
    () => (recipe ? scaleIngredientList(freeIngredients(recipe), freeFactor) : []),
    [recipe, freeFactor],
  );

  // Jede Komponente skaliert über ihre EIGENE Portionsbasis.
  const componentRows = useMemo(
    () =>
      (recipe?.components ?? []).map((c: RecipeComponentWithRelations) => {
        const base = componentBaseServings(c);
        return {
          component: c,
          base,
          rows: scaleIngredientList(
            componentIngredients(c, selection),
            summary.totalServings / base,
          ),
        };
      }),
    [recipe, selection, summary.totalServings],
  );

  const steps = useMemo(
    () => (recipe ? [...recipe.steps].sort((a, b) => a.step_number - b.step_number) : []),
    [recipe],
  );

  const cooked = !!summary.cookedAt;

  const toggle = useMutation({
    mutationFn: () => setBatchCooked(summary.groupId, !cooked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch-cook-week"] });
      queryClient.invalidateQueries({ queryKey: ["meal-plan"] });
      toast.success(cooked ? "Häkchen entfernt" : "Als gekocht markiert");
      if (!cooked) onClose();
    },
    onError: () => toast.error("Konnte nicht gespeichert werden"),
  });

  useSwipePriority({ onSwipeLeft: onClose, onSwipeRight: onClose });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CookingPot className="h-4 w-4 text-primary" />
            <span className="truncate">{summary.title}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span>
              Charge: {summary.totalServings}{" "}
              {summary.totalServings === 1 ? "Portion" : "Portionen"}
            </span>
            {summary.totalMinutes != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {summary.totalMinutes} Min.
              </span>
            )}
            {summary.followUpDays > 0 && (
              <span>
                reicht für {summary.followUpDays} Folgetag
                {summary.followUpDays === 1 ? "" : "e"}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {!summary.recipeId ? (
            <p className="text-sm text-muted-foreground">
              Für diesen Eintrag ist kein Rezept verknüpft.
            </p>
          ) : isPending || !recipe ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              {componentRows.map(({ component, base, rows }) => (
                <section key={component.id}>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold">{component.name}</h3>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {summary.totalServings} Port. (Basis {base})
                    </span>
                  </div>
                  <IngredientRows rows={rows} />
                </section>
              ))}

              {(componentRows.length === 0 || freeRows.length > 0) && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">
                    {componentRows.length > 0 ? "Weitere Zutaten" : "Zutaten"}
                  </h3>
                  <IngredientRows rows={freeRows} />
                </section>
              )}

              <section>
                <h3 className="mb-2 text-sm font-semibold">Zubereitung</h3>
                {steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Schritte hinterlegt</p>
                ) : (
                  <ol className="space-y-3">
                    {steps.map((s) => (
                      <li key={s.id} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-semibold text-primary-foreground">
                          {s.step_number}
                        </span>
                        <p className="pt-0.5 text-sm leading-relaxed">{s.instruction}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>

        <div className="border-t border-border/60 px-5 py-4">
          <Button
            className="w-full"
            variant={cooked ? "outline" : "default"}
            disabled={toggle.isPending}
            onClick={() => toggle.mutate()}
          >
            {toggle.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : cooked ? (
              <Undo2 className="mr-2 h-4 w-4" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {cooked ? "Häkchen entfernen" : "Fertig / Gekocht"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
