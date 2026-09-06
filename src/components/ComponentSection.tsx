import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ExternalLink, Link2Off, Plus, Save, Star, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { IngredientInput, type IngredientDraft } from "@/components/IngredientInput";
import { DraggableIngredientRow } from "@/components/DraggableIngredientRow";
import { DroppableComponentZone } from "@/components/DroppableComponentZone";
import { recipesQuery } from "@/lib/recipes";
import { resolveIngredients } from "@/lib/resolveIngredient";
import { makeUid } from "@/lib/uid";
import type { NutritionTotals } from "@/lib/componentNutrition";
import type { ComponentType } from "@/types/recipe";
import { cn } from "@/lib/utils";

export interface VariantDraft {
  _uid: string;
  id: string | null;
  label: string;
  is_default: boolean;
  ingredients: IngredientDraft[];
}

export interface ComponentDraft {
  /** Stabile Client-ID. */
  _uid: string;
  /** DB-ID, falls die Komponente bereits gespeichert ist. */
  id: string | null;
  name: string;
  servings: number | "";
  linked_recipe_id: string | null;
  /** 'fixed' = feste Zutaten, 'choice' = Varianten zur Auswahl. */
  component_type: ComponentType;
  ingredients: IngredientDraft[];
  variants: VariantDraft[];
}

export function emptyVariant(label = ""): VariantDraft {
  return { _uid: makeUid(), id: null, label, is_default: false, ingredients: [] };
}

export function ComponentSection({
  value,
  onChange,
  onRemove,
  onAddIngredient,
  onSaveAsRecipe,
  savingAsRecipe,
  showNutrition,
  expandedIngredientId,
  onToggleIngredient,
  index,
  expanded,
  onToggleExpand,
  perServing,
  newIngredient,
}: {
  value: ComponentDraft;
  onChange: (v: ComponentDraft) => void;
  onRemove: () => void;
  onAddIngredient: () => void;
  onSaveAsRecipe?: () => void;
  savingAsRecipe?: boolean;
  showNutrition: boolean;
  expandedIngredientId: string | null;
  onToggleIngredient: (uid: string) => void;
  index: number;
  expanded: boolean;
  onToggleExpand: () => void;
  /** Nährwerte pro Portion dieser Komponente (kompakt im Header). */
  perServing?: NutritionTotals;
  /** Fabrik für eine leere Zutat (Varianten-Zutaten). */
  newIngredient: () => IngredientDraft;
}) {
  const isLinked = !!value.linked_recipe_id;
  const isChoice = value.component_type === "choice";
  const { data: recipes = [] } = useQuery({ ...recipesQuery(), enabled: isLinked });
  const linked = isLinked ? recipes.find((r) => r.id === value.linked_recipe_id) ?? null : null;
  const linkedIngredients = linked ? resolveIngredients(linked.ingredients) : [];

  const displayName = value.name.trim() || `Komponente ${index + 1}`;
  const servingsLabel =
    value.servings !== "" && Number(value.servings) > 0 ? `${value.servings} Port.` : null;
  const kcal = perServing?.calories;

  function updateVariant(uid: string, patch: Partial<VariantDraft>) {
    onChange({
      ...value,
      variants: value.variants.map((v) => (v._uid === uid ? { ...v, ...patch } : v)),
    });
  }

  function setDefaultVariant(uid: string) {
    onChange({
      ...value,
      variants: value.variants.map((v) => ({ ...v, is_default: v._uid === uid })),
    });
  }

  function addVariant() {
    const fresh = emptyVariant();
    fresh.ingredients = [newIngredient()];
    fresh.is_default = value.variants.length === 0;
    onChange({ ...value, variants: [...value.variants, fresh] });
  }

  function setType(type: ComponentType) {
    if (type === value.component_type) return;
    if (type === "choice") {
      const first = emptyVariant("Variante 1");
      first.is_default = true;
      first.ingredients =
        value.ingredients.length > 0 ? value.ingredients : [newIngredient()];
      onChange({
        ...value,
        component_type: "choice",
        ingredients: [],
        variants: value.variants.length > 0 ? value.variants : [first],
      });
    } else {
      const fromVariant =
        value.variants.find((v) => v.is_default)?.ingredients ??
        value.variants[0]?.ingredients ??
        [];
      onChange({
        ...value,
        component_type: "fixed",
        ingredients: value.ingredients.length > 0 ? value.ingredients : fromVariant,
      });
    }
  }

  return (
    <DroppableComponentZone
      id={`comp:${value._uid}`}
      className="overflow-hidden rounded-xl border border-border bg-muted/20"
    >
      {/* Accordion-Header (auch Drop-Ziel, da Teil der Zone) */}
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{displayName}</span>
        {isChoice && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            Auswahl
          </span>
        )}
        {servingsLabel && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {servingsLabel}
          </span>
        )}
        {kcal != null && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {Math.round(kcal)} kcal/P
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Accordion-Body */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-border/60 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[8rem] flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {isLinked ? "Anzeigename" : `Komponente ${index + 1}`}
                </Label>
                <Input
                  value={value.name}
                  placeholder="z.B. Sauce"
                  maxLength={80}
                  onChange={(e) => onChange({ ...value, name: e.target.value })}
                />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs text-muted-foreground">Portionen</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder="1"
                  value={value.servings}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      servings: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                aria-label="Komponente entfernen"
                className="mb-0.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {!isLinked && (
              <div className="mt-3 flex items-center gap-1 rounded-lg bg-muted/50 p-1">
                {(
                  [
                    ["fixed", "Fixe Zutaten"],
                    ["choice", "Auswahl (Varianten)"],
                  ] as const
                ).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      value.component_type === t
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {isLinked ? (
              <div className="mt-3 space-y-2 border-t border-dashed border-border pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Zutaten aus „{linked?.title ?? "verlinktem Rezept"}" – bearbeiten dort möglich
                  </span>
                  <div className="flex items-center gap-3">
                    {value.linked_recipe_id && (
                      <Link
                        to="/recipes/$id"
                        params={{ id: value.linked_recipe_id }}
                        target="_blank"
                        className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Öffnen
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => onChange({ ...value, linked_recipe_id: null })}
                      className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
                    >
                      <Link2Off className="h-3.5 w-3.5" /> Verknüpfung lösen
                    </button>
                  </div>
                </div>
                <ul className="space-y-1 rounded-lg bg-background/60 p-3 text-sm">
                  {linkedIngredients.length === 0 ? (
                    <li className="text-muted-foreground">Keine Zutaten</li>
                  ) : (
                    linkedIngredients.map((ing) => (
                      <li key={ing.id} className="flex justify-between gap-3">
                        <span className="truncate">{ing.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {ing.amount ?? ""} {ing.unit ?? ""}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : isChoice ? (
              <div className="mt-3 space-y-3 border-t border-dashed border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  Nur die gewählte Variante zählt in die Nährwerte.
                </p>
                {value.variants.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    Noch keine Varianten
                  </p>
                )}
                {value.variants.map((variant, vi) => (
                  <div
                    key={variant._uid}
                    className="space-y-2 rounded-lg border border-border bg-background/60 p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={variant.label}
                        placeholder={`Variante ${vi + 1} (z.B. Himbeere)`}
                        maxLength={80}
                        onChange={(e) => updateVariant(variant._uid, { label: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Als Standard markieren"
                        onClick={() => setDefaultVariant(variant._uid)}
                        className={cn(
                          "shrink-0",
                          variant.is_default ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        <Star
                          className={cn("h-4 w-4", variant.is_default && "fill-current")}
                        />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Variante entfernen"
                        onClick={() =>
                          onChange({
                            ...value,
                            variants: value.variants.filter((v) => v._uid !== variant._uid),
                          })
                        }
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {variant.ingredients.map((ing, i) => (
                        <IngredientInput
                          key={ing._uid}
                          index={i}
                          value={ing}
                          showNutrition={showNutrition}
                          expanded={expandedIngredientId === ing._uid}
                          onToggleExpand={() => onToggleIngredient(ing._uid)}
                          onChange={(v) =>
                            updateVariant(variant._uid, {
                              ingredients: variant.ingredients.map((x, idx) =>
                                idx === i ? v : x,
                              ),
                            })
                          }
                          onRemove={() =>
                            updateVariant(variant._uid, {
                              ingredients: variant.ingredients.filter((_, idx) => idx !== i),
                            })
                          }
                        />
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const fresh = newIngredient();
                        updateVariant(variant._uid, {
                          ingredients: [...variant.ingredients, fresh],
                        });
                        onToggleIngredient(fresh._uid);
                      }}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Zutat
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                  <Plus className="mr-1 h-4 w-4" /> Variante hinzufügen
                </Button>
              </div>
            ) : (
              <div className="mt-3 space-y-2 border-t border-dashed border-border pt-3">
                <div className="space-y-2">
                  {value.ingredients.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                      Zutat hinzufügen oder eine Zutat hierher ziehen
                    </p>
                  )}
                  {value.ingredients.map((ing, i) => (
                    <DraggableIngredientRow
                      key={ing._uid}
                      uid={ing._uid}
                      fromComponentUid={value._uid}
                    >
                      <IngredientInput
                        index={i}
                        value={ing}
                        showNutrition={showNutrition}
                        expanded={expandedIngredientId === ing._uid}
                        onToggleExpand={() => onToggleIngredient(ing._uid)}
                        onChange={(v) =>
                          onChange({
                            ...value,
                            ingredients: value.ingredients.map((x, idx) => (idx === i ? v : x)),
                          })
                        }
                        onRemove={() =>
                          onChange({
                            ...value,
                            ingredients: value.ingredients.filter((_, idx) => idx !== i),
                          })
                        }
                      />
                    </DraggableIngredientRow>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={onAddIngredient}>
                    <Plus className="mr-1 h-4 w-4" /> Zutat
                  </Button>
                  {onSaveAsRecipe && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onSaveAsRecipe}
                      disabled={savingAsRecipe}
                    >
                      <Save className="mr-1 h-4 w-4" /> Als eigenes Rezept speichern
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DroppableComponentZone>
  );
}
