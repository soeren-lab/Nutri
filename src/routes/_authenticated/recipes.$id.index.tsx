import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Clock,
  Users,
  Pencil,
  Trash2,
  Heart,
  ChevronLeft,
  ImageIcon,
  ChefHat,
  Link as LinkIcon,
  AlertTriangle,
  ChevronRight,

} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/CategoryBadge";
import { PublishButton } from "@/components/PublishButton";
import { SharedWithBadge } from "@/components/SharedWithBadge";
import { ShareWithFriendsDialog } from "@/components/ShareWithFriendsDialog";

import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  recipeQuery,
  favoritesQuery,
  toggleFavorite,
  deleteRecipe,
  setIngredientMaster,
} from "@/lib/recipes";
import { useSignedImage } from "@/hooks/use-signed-image";
import { NutritionSummary } from "@/components/NutritionSummary";
import { resolveIngredients } from "@/lib/resolveIngredient";
import {
  componentNutritionPerServing,
  freeIngredients,
  nutritionPerServing,
} from "@/lib/componentNutrition";
import { VariantChips } from "@/components/VariantChips";
import { FlexibleIngredientPicker } from "@/components/FlexibleIngredientPicker";
import { useIngredientsMaster } from "@/hooks/use-ingredients-master";
import {
  applyGroupChoices,
  pendingGroupIngredients,
  type GroupChoices,
} from "@/lib/productGroups";
import type { ResolvedIngredient } from "@/lib/resolveIngredient";
import {
  defaultSelection,
  effectiveComponentIngredients,
  isChoiceComponent,
  selectedVariantId,
  type VariantSelection,
} from "@/lib/variants";

import { toast } from "sonner";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/recipes/$id/")({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(recipeQuery(params.id));
  },
  component: RecipeDetailPage,
  pendingComponent: () => (
    <div className="space-y-4">
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-24 w-full" />
    </div>
  ),
});

function RecipeDetailPage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { data: rawRecipe } = useSuspenseQuery(recipeQuery(id));
  const { data: favIds = [] } = useSuspenseQuery(favoritesQuery(user.id));
  const masters = useIngredientsMaster();
  // Gewählte Sorten für flexible Zutaten (Produktgruppen).
  const [groupChoices, setGroupChoices] = useState<GroupChoices>({});
  const recipe = useMemo(
    () => applyGroupChoices(rawRecipe, groupChoices, masters),
    [rawRecipe, groupChoices, masters],
  );
  const { data: imageUrl } = useSignedImage(recipe.image_url);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Gewählte Varianten der 'choice'-Komponenten (Standard vorausgewählt).
  const [variantSelection, setVariantSelection] = useState<VariantSelection>(() =>
    defaultSelection(rawRecipe.components),
  );

  const isFav = favIds.includes(recipe.id);
  const isOwner = recipe.user_id === user.id;

  const favMut = useMutation({
    mutationFn: () => toggleFavorite(user.id, recipe.id, isFav),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites", user.id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteRecipe(recipe.id);
      // Aktives gcTime: Infinity (offline-persistence.ts) heißt: ohne diesen
      // Schritt würde der Detail- und Bild-Cache eines gelöschten Rezepts
      // nie mehr automatisch entfernt – weder aus dem Live-Cache noch beim
      // nächsten Speicherzyklus aus IndexedDB.
      qc.removeQueries({ queryKey: ["recipes", recipe.id] });
      if (recipe.image_url) {
        qc.removeQueries({ queryKey: ["signed-image", recipe.image_url] });
      }
      await qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Rezept gelöscht");
      navigate({ to: "/recipes" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen");
      setDeleting(false);
    }
  }

  async function pickGroup(ingredientId: string, masterId: string) {
    setGroupChoices((c) => ({ ...c, [ingredientId]: masterId }));
    if (!isOwner) return;
    // Im Rezept wird die Sorte dauerhaft als Standard hinterlegt.
    try {
      await setIngredientMaster(ingredientId, masterId);
      await qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Sorte als Standard gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    }
  }

  const openGroups = pendingGroupIngredients(recipe, variantSelection);

  const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1">
        <Link to="/recipes">
          <ChevronLeft className="h-4 w-4" /> Zurück
        </Link>
      </Button>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={recipe.title}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : null}
          {!imageUrl && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <ImageIcon className="h-12 w-12" />
            </div>
          )}
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{recipe.title}</h1>
              {(() => {
                const cats =
                  recipe.categories && recipe.categories.length > 0
                    ? recipe.categories
                    : recipe.category
                      ? [recipe.category]
                      : [];
                if (cats.length === 0) return null;
                return (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cats.map((c) => (
                      <CategoryBadge key={c} name={c} />
                    ))}
                  </div>
                );
              })()}
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => favMut.mutate()}
                aria-label={isFav ? "Aus Favoriten entfernen" : "Zu Favoriten"}
              >
                <Heart className={cn("h-4 w-4", isFav && "fill-primary text-primary")} />
              </Button>
              {isOwner && (
                <>
                  <Button asChild variant="outline" size="icon" aria-label="Bearbeiten">
                    <Link to="/recipes/$id/edit" params={{ id: recipe.id }}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="Löschen">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Rezept löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                          Löschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>

          {recipe.description && (
            <p className="text-sm text-muted-foreground">{recipe.description}</p>
          )}

          {isOwner && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
              <div className="text-sm font-medium">Community-Hub</div>
              <p className="text-xs text-muted-foreground">
                Veröffentlichen macht dieses Rezept inklusive Komponenten, Varianten und
                Zutaten für andere sichtbar.
              </p>
              <PublishButton
                target={{
                  kind: "recipe",
                  id: recipe.id,
                  name: recipe.title,
                  isPublished: recipe.is_published,
                  publishedVersion: recipe.published_version ?? 0,
                }}
              />

              <div className="space-y-2 border-t border-border pt-3">
                <div className="text-sm font-medium">Privat mit Freunden teilen</div>
                <p className="text-xs text-muted-foreground">
                  Nur ausgewählte Freunde sehen dieses Rezept in deinem Profil – ohne
                  Community-Veröffentlichung.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setShareOpen(true)}
                >
                  <Users className="h-4 w-4" />
                  Mit Freund teilen
                </Button>
                <SharedWithBadge contentType="recipe" contentId={recipe.id} />
              </div>
            </div>
          )}

          <ShareWithFriendsDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            contentType="recipe"
            contentId={recipe.id}
            contentName={recipe.title}
          />



          <div className="flex flex-wrap gap-4 border-t border-border pt-4 text-sm">

            {recipe.servings != null && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{recipe.servings} Portionen</span>
              </div>
            )}
            {totalTime > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {totalTime} min
                  {recipe.prep_time_minutes != null && recipe.cook_time_minutes != null && (
                    <>
                      {" "}
                      ({recipe.prep_time_minutes} + {recipe.cook_time_minutes})
                    </>
                  )}
                </span>
              </div>
            )}
          </div>

          <Button
            asChild
            size="lg"
            className="w-full gap-2 bg-gradient-to-br from-primary to-accent text-primary-foreground"
          >
            <Link to="/recipes/$id/cook" params={{ id: recipe.id }}>
              <ChefHat className="h-5 w-5" /> Kochen starten
            </Link>
          </Button>
        </div>
      </div>

      {(() => {
        const hasComponents = recipe.components.length > 0;
        const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
        // Einheitlich für ALLE Rezepte: Werte pro Portion.
        const totals = nutritionPerServing(recipe, variantSelection);
        const hasAny =
          totals.calories != null ||
          totals.protein_g != null ||
          totals.carbs_g != null ||
          totals.fat_g != null ||
          totals.fiber_g != null ||
          totals.sugar_g != null;

        // Flache Zutatenliste über alle Komponenten, jeweils anteilig pro Portion.
        type FlatRow = {
          key: string;
          name: string;
          component: string | null;
          factor: number;
          calories: number | null;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          fiber_g: number | null;
          sugar_g: number | null;
        };
        const scale = (v: number | null, f: number) =>
          v == null ? null : Math.round(v * f * 10) / 10;
        const flat: FlatRow[] = [];
        for (const ing of resolveIngredients(freeIngredients(recipe))) {
          flat.push({
            key: `free-${ing.id}`,
            name: ing.name,
            component: null,
            factor: 1 / servings,
            calories: scale(ing.calories, 1 / servings),
            protein_g: scale(ing.protein_g, 1 / servings),
            carbs_g: scale(ing.carbs_g, 1 / servings),
            fat_g: scale(ing.fat_g, 1 / servings),
            fiber_g: scale(ing.fiber_g, 1 / servings),
            sugar_g: scale(ing.sugar_g, 1 / servings),
          });
        }
        for (const c of recipe.components) {
          const compServings = c.servings && c.servings > 0 ? c.servings : 1;
          const rows = c.linked_recipe_id
            ? resolveIngredients(c.linked ? freeIngredients(c.linked) : [])
            : resolveIngredients(effectiveComponentIngredients(c, variantSelection));
          const f =
            1 /
            (c.linked_recipe_id
              ? c.linked?.servings && c.linked.servings > 0
                ? c.linked.servings
                : 1
              : compServings);
          for (const ing of rows) {
            flat.push({
              key: `${c.id}-${ing.id}`,
              name: ing.name,
              component: c.name,
              factor: f,
              calories: scale(ing.calories, f),
              protein_g: scale(ing.protein_g, f),
              carbs_g: scale(ing.carbs_g, f),
              fat_g: scale(ing.fat_g, f),
              fiber_g: scale(ing.fiber_g, f),
              sugar_g: scale(ing.sugar_g, f),
            });
          }
        }

        if (!hasAny && flat.length === 0) return null;
        return (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Nährwerte</h2>
              <span className="text-xs text-muted-foreground">pro Portion</span>
            </div>

            <NutritionSummary totals={totals} />

            {hasComponents && (
              <div className="mt-4 space-y-1 text-sm">
                {recipe.components.map((c) => {
                  const per = componentNutritionPerServing(c, 0, variantSelection);
                  return (
                    <div
                      key={c.id}
                      className="flex justify-between gap-3 border-b border-border/60 py-1.5 last:border-0"
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {per.calories != null ? `${per.calories} kcal` : "–"} / Portion
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {flat.length > 0 && (
              <Collapsible className="mt-4">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    Nährwerte pro Zutat
                    <span className="text-xs text-muted-foreground">anzeigen</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="py-2 pr-3 font-normal">Zutat</th>
                          <th className="py-2 pr-3 text-right font-normal">kcal</th>
                          <th className="py-2 pr-3 text-right font-normal">P</th>
                          <th className="py-2 pr-3 text-right font-normal">KH</th>
                          <th className="py-2 pr-3 text-right font-normal">F</th>
                          <th className="py-2 pr-3 text-right font-normal">BS</th>
                          <th className="py-2 text-right font-normal">Zucker</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flat.map((ing) => (
                          <tr key={ing.key} className="border-b border-border/60 last:border-0">
                            <td className="py-2 pr-3">
                              <span>{ing.name}</span>
                              {ing.component && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({ing.component})
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {ing.calories ?? "–"}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {ing.protein_g ?? "–"}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {ing.carbs_g ?? "–"}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {ing.fat_g ?? "–"}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {ing.fiber_g ?? "–"}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {ing.sugar_g ?? "–"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </section>
        );
      })()}


      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Zutaten</h2>
          {openGroups.length > 0 && (
            <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Sorte nicht gewählt – Nährwerte unvollständig.
            </p>
          )}
          {recipe.components.length === 0 ? (
            <IngredientRows
              rows={resolveIngredients(recipe.ingredients)}
              choices={groupChoices}
              onPick={pickGroup}
            />
          ) : (
            <div className="space-y-5">
              {recipe.components.map((c) => {
                const rows = c.linked_recipe_id
                  ? resolveIngredients(c.linked ? freeIngredients(c.linked) : [])
                  : resolveIngredients(effectiveComponentIngredients(c, variantSelection));
                return (
                  <div key={c.id} className="space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold">
                        {c.linked_recipe_id ? (
                          <Link
                            to="/recipes/$id"
                            params={{ id: c.linked_recipe_id }}
                            className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                          >
                            {c.name}
                            <LinkIcon className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          c.name
                        )}
                      </h3>
                      {c.servings != null && (
                        <span className="text-xs text-muted-foreground">
                          {c.servings} {Number(c.servings) === 1 ? "Portion" : "Portionen"}
                        </span>
                      )}
                    </div>
                    {isChoiceComponent(c) && (
                      <VariantChips
                        component={c}
                        selectedId={selectedVariantId(c, variantSelection)}
                        onSelect={(variantId) =>
                          setVariantSelection((s) => ({ ...s, [c.id]: variantId }))
                        }
                      />
                    )}
                    <IngredientRows rows={rows} choices={groupChoices} onPick={pickGroup} />
                  </div>
                );
              })}

              {freeIngredients(recipe).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Weitere Zutaten</h3>
                  <IngredientRows
                    rows={resolveIngredients(freeIngredients(recipe))}
                    choices={groupChoices}
                    onPick={pickGroup}
                  />
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Zubereitung</h2>
          <ol className="space-y-4">
            {recipe.steps.map((s) => (
              <li key={s.id} className="flex gap-3 text-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {s.step_number}
                </div>
                <p className="pt-0.5 leading-relaxed">{s.instruction}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

/** Zutaten-Liste mit Sorten-Auswahl für flexible Zutaten (Produktgruppen). */
function IngredientRows({
  rows,
  onPick,
  choices,
}: {
  rows: ResolvedIngredient[];
  choices: GroupChoices;
  onPick: (ingredientId: string, masterId: string) => void;
}) {
  return (
    <ul className="space-y-2 text-sm">
      {rows.length === 0 ? (
        <li className="text-muted-foreground">Keine Zutaten</li>
      ) : (
        rows.map((ing) =>
          ing.productGroup ? (
            <FlexibleIngredientRow
              key={ing.id}
              ing={ing}
              choices={choices}
              onPick={onPick}
            />
          ) : (
            <li key={ing.id} className="border-b border-border/70 pb-2 last:border-0">
              <div className="flex justify-between gap-3">
                <span>{ing.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {ing.amount ?? ""} {ing.unit ?? ""}
                </span>
              </div>
            </li>
          ),
        )
      )}
    </ul>
  );
}

/**
 * Zeile einer flexiblen Zutat: die GANZE Zeile öffnet die Sorten-Auswahl –
 * sowohl im Zustand „Sorte wählen" als auch wenn schon eine Sorte gewählt ist.
 */
function FlexibleIngredientRow({
  ing,
  choices,
  onPick,
}: {
  ing: ResolvedIngredient;
  choices: GroupChoices;
  onPick: (ingredientId: string, masterId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const group = ing.productGroup as string;
  const value = ing.isGroup ? (choices[ing.id] ?? null) : ing.ingredient_master_id;

  return (
    <li className="border-b border-border/70 pb-2 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-start justify-between gap-3 rounded-md text-left transition-colors hover:bg-muted/40"
      >
        <span className="min-w-0">
          <span className="block truncate">{ing.name}</span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-primary">
            {ing.isGroup ? "Sorte auswählen" : `${group} · Sorte ändern`}
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          </span>
        </span>
        <span className="shrink-0 text-muted-foreground">
          {ing.amount ?? ""} {ing.unit ?? ""}
        </span>
      </button>
      <FlexibleIngredientPicker
        group={group}
        value={value}
        onSelect={(m) => onPick(ing.id, m.id)}
        open={open}
        onOpenChange={setOpen}
        variant="hidden"
      />
    </li>
  );
}

