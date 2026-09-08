import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, X, Timer, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NutritionSummary } from "@/components/NutritionSummary";
import { scaleIngredientList, type ScaledIngredient } from "@/hooks/use-scaled-ingredients";
import { useWakeLock } from "@/hooks/use-wake-lock";
import {
  freeIngredients,
  totalsForServingsMap,
  hasAnyNutrition as totalsHaveValues,
} from "@/lib/componentNutrition";
import type { RecipeComponentWithRelations, RecipeWithRelations } from "@/types/recipe";
import { VariantChips } from "@/components/VariantChips";
import { GroupChoiceDialog } from "@/components/GroupChoiceDialog";
import { useIngredientsMaster } from "@/hooks/use-ingredients-master";
import { applyGroupChoices, pendingGroupIngredients, type GroupChoices } from "@/lib/productGroups";
import {
  defaultSelection,
  isChoiceComponent,
  selectedVariantId,
  type VariantSelection,
} from "@/lib/variants";
import {
  componentBaseServings,
  componentIngredients,
  positiveServings as positive,
} from "@/lib/portionScaling";
import { cn } from "@/lib/utils";

const TIME_REGEX = /(\d+)\s*(min(?:uten)?|std|stunden?|sek(?:unden)?)/i;

function parseStepMinutes(text: string): number | null {
  const m = text.match(TIME_REGEX);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("std") || unit.startsWith("stunde")) return value * 60;
  if (unit.startsWith("sek")) return Math.max(1, Math.round(value / 60));
  return value;
}

function Stepper({
  value,
  onChange,
  label,
  hint,
  size = "lg",
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  hint?: string;
  size?: "lg" | "sm";
}) {
  const big = size === "lg";
  return (
    <div className={big ? "" : "flex items-center justify-between gap-3"}>
      <div className={big ? "text-sm text-muted-foreground" : "min-w-0"}>
        <div className={big ? "" : "truncate text-sm font-medium text-foreground"}>{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div
        className={cn("flex items-center", big ? "mt-6 justify-center gap-6" : "shrink-0 gap-3")}
      >
        <Button
          variant="outline"
          size="icon"
          className={big ? "h-14 w-14 rounded-full" : "h-9 w-9 rounded-full"}
          onClick={() => onChange(Math.max(1, value - 1))}
          aria-label={`${label}: weniger`}
        >
          <Minus className={big ? "h-6 w-6" : "h-4 w-4"} />
        </Button>
        <div
          className={cn(
            "text-center font-semibold tabular-nums",
            big ? "min-w-[3ch] text-5xl" : "min-w-[2ch] text-lg",
          )}
        >
          {value}
        </div>
        <Button
          variant="outline"
          size="icon"
          className={big ? "h-14 w-14 rounded-full" : "h-9 w-9 rounded-full"}
          onClick={() => onChange(Math.min(99, value + 1))}
          aria-label={`${label}: mehr`}
        >
          <Plus className={big ? "h-6 w-6" : "h-4 w-4"} />
        </Button>
      </div>
    </div>
  );
}

function IngredientList({ rows }: { rows: ScaledIngredient[] }) {
  return (
    <ul className="space-y-2 text-base">
      {rows.length === 0 ? (
        <li className="text-sm text-muted-foreground">Keine Zutaten</li>
      ) : (
        rows.map((ing) => (
          <li
            key={ing.id}
            className="flex justify-between gap-3 border-b border-border/60 pb-2 last:border-0"
          >
            <span>{ing.name}</span>
            <span className="tabular-nums text-muted-foreground">
              {ing.displayAmount} {ing.unit ?? ""}
            </span>
          </li>
        ))
      )}
    </ul>
  );
}

export function CookModeView({ recipe: rawRecipe }: { recipe: RecipeWithRelations }) {
  const masters = useIngredientsMaster();
  const [groupChoices, setGroupChoices] = useState<GroupChoices>({});
  const [askGroups, setAskGroups] = useState(false);
  const recipe = useMemo(
    () => applyGroupChoices(rawRecipe, groupChoices, masters),
    [rawRecipe, groupChoices, masters],
  );

  const baseServings = positive(recipe.servings);
  const components = recipe.components ?? [];
  const hasComponents = components.length > 0;
  const free = freeIngredients(recipe);

  const [started, setStarted] = useState(false);
  const [servings, setServings] = useState<number>(Math.round(baseServings));
  const [componentServings, setComponentServings] = useState<Record<string, number>>(() =>
    Object.fromEntries(components.map((c) => [c.id, Math.round(componentBaseServings(c))])),
  );
  const [variantSelection, setVariantSelection] = useState<VariantSelection>(() =>
    defaultSelection(components),
  );
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [timers, setTimers] = useState<Record<string, number>>({});

  // Alle flexiblen Zutaten (Produktgruppen) – unabhängig davon, ob schon
  // eine Sorte gewählt wurde, damit die Wahl änderbar bleibt.
  const flexGroups = useMemo(
    () => pendingGroupIngredients(rawRecipe, variantSelection),
    [rawRecipe, variantSelection],
  );
  // Noch offene Produktgruppen (keine Sorte gewählt).
  const pendingGroups = useMemo(
    () => flexGroups.filter((p) => !groupChoices[p.ingredient.id]),
    [flexGroups, groupChoices],
  );

  useWakeLock(started);

  const scaledFree = useMemo(
    () => scaleIngredientList(free, servings / baseServings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipe, servings, baseServings],
  );

  const scaledComponents = useMemo(
    () =>
      components.map((c) => {
        const base = componentBaseServings(c);
        const want = componentServings[c.id] ?? Math.round(base);
        return {
          component: c,
          servings: want,
          rows: scaleIngredientList(componentIngredients(c, variantSelection), want / base),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipe, componentServings, variantSelection],
  );

  const totals = useMemo(
    () => totalsForServingsMap(recipe, componentServings, servings, variantSelection),

    [recipe, componentServings, servings, variantSelection],
  );

  const simpleTotals = useMemo(() => {
    const factor = servings / baseServings;
    const scale = (v: number | null) => (v == null ? null : Math.round(v * factor * 10) / 10);
    return {
      calories: scale(recipe.calories),
      protein_g: scale(recipe.protein_g),
      carbs_g: scale(recipe.carbs_g),
      fat_g: scale(recipe.fat_g),
      fiber_g: scale(recipe.fiber_g),
      sugar_g: scale(recipe.sugar_g),
    };
  }, [recipe, servings, baseServings]);

  const shownTotals = (recipe.nutrition_mode ?? "simple") === "advanced" ? totals : simpleTotals;
  const showNutrition = totalsHaveValues(shownTotals);

  const steps = useMemo(
    () => [...recipe.steps].sort((a, b) => a.step_number - b.step_number),
    [recipe.steps],
  );

  useEffect(() => {
    if (!started) return;
    const active = Object.entries(timers).filter(([, s]) => s > 0);
    if (active.length === 0) return;
    const t = setInterval(() => {
      setTimers((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key] > 0) next[key] = next[key] - 1;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [started, timers]);

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startTimer(id: string, minutes: number) {
    setTimers((prev) => ({ ...prev, [id]: minutes * 60 }));
  }

  const fmtTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <header className="flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Kochmodus</div>
          <h1 className="truncate text-lg font-semibold">{recipe.title}</h1>
        </div>
        <Button asChild variant="ghost" size="icon" aria-label="Beenden">
          <Link to="/recipes/$id" params={{ id: recipe.id }}>
            <X className="h-5 w-5" />
          </Link>
        </Button>
      </header>

      {!started ? (
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto w-full max-w-sm space-y-8 text-center">
            {(!hasComponents || free.length > 0) && (
              <div>
                <Stepper
                  label="Wie viele Portionen?"
                  value={servings}
                  onChange={setServings}
                  size="lg"
                />
                <div className="mt-3 text-xs text-muted-foreground">
                  Original: {baseServings} {baseServings === 1 ? "Portion" : "Portionen"}
                </div>
              </div>
            )}

            {hasComponents && (
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-left">
                <div className="text-sm font-semibold">Portionen je Komponente</div>
                {components.map((c) => (
                  <div key={c.id} className="space-y-1.5">
                    <Stepper
                      size="sm"
                      label={c.name}
                      hint={`Original: ${componentBaseServings(c)}`}
                      value={componentServings[c.id] ?? Math.round(componentBaseServings(c))}
                      onChange={(v) => setComponentServings((s) => ({ ...s, [c.id]: v }))}
                    />
                    {isChoiceComponent(c) && (
                      <VariantChips
                        component={c}
                        selectedId={selectedVariantId(c, variantSelection)}
                        onSelect={(variantId) =>
                          setVariantSelection((s) => ({ ...s, [c.id]: variantId }))
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {pendingGroups.length > 0 && (
              <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                {pendingGroups.length === 1
                  ? "Eine Produktgruppe braucht noch eine Sorte."
                  : `${pendingGroups.length} Produktgruppen brauchen noch eine Sorte.`}
              </p>
            )}

            <Button
              size="lg"
              className="w-full bg-gradient-to-br from-primary to-accent text-primary-foreground"
              onClick={() => (flexGroups.length > 0 ? setAskGroups(true) : setStarted(true))}
            >
              {flexGroups.length > 0 ? "Sorte wählen" : "Los geht's"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-8">
            {flexGroups.length > 0 && (
              <Button variant="outline" className="w-full" onClick={() => setAskGroups(true)}>
                {pendingGroups.length > 0 ? "Sorte für Produktgruppe wählen" : "Sorte ändern"}
              </Button>
            )}
            {scaledComponents.map(({ component: c, servings: cs, rows }) => (
              <section key={c.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">
                    {c.linked_recipe_id ? (
                      <Link
                        to="/recipes/$id"
                        params={{ id: c.linked_recipe_id }}
                        className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                      >
                        {c.name}
                        <LinkIcon className="h-4 w-4" />
                      </Link>
                    ) : (
                      c.name
                    )}
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {cs} {cs === 1 ? "Portion" : "Portionen"}
                    </span>
                    <Stepper
                      size="sm"
                      label={c.name}
                      value={cs}
                      onChange={(v) => setComponentServings((s) => ({ ...s, [c.id]: v }))}
                    />
                  </div>
                </div>
                {isChoiceComponent(c) && (
                  <VariantChips
                    component={c}
                    selectedId={selectedVariantId(c, variantSelection)}
                    onSelect={(variantId) =>
                      setVariantSelection((s) => ({ ...s, [c.id]: variantId }))
                    }
                    className="mb-3"
                  />
                )}
                <IngredientList rows={rows} />
              </section>
            ))}

            {(!hasComponents || free.length > 0) && (
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold">
                    {hasComponents ? "Weitere Zutaten" : "Zutaten"}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    für {servings} {servings === 1 ? "Portion" : "Portionen"}
                  </span>
                </div>
                <IngredientList rows={scaledFree} />
              </section>
            )}

            {showNutrition && (
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold">Nährwerte</h2>
                  <span className="text-xs text-muted-foreground">
                    gesamt für die gewählten Portionen
                  </span>
                </div>
                <NutritionSummary totals={shownTotals} />
              </section>
            )}

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Zubereitung</h2>
              {steps.map((s) => {
                const done = checked.has(s.id);
                const stepMinutes = parseStepMinutes(s.instruction);
                const timerLeft = timers[s.id];
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "rounded-2xl border border-border bg-card p-5 transition",
                      done && "opacity-60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleChecked(s.id)}
                      className="flex w-full items-start gap-4 text-left"
                      aria-pressed={done}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                          done
                            ? "bg-primary text-primary-foreground line-through"
                            : "bg-gradient-to-br from-primary to-accent text-primary-foreground",
                        )}
                      >
                        {s.step_number}
                      </div>
                      <p
                        className={cn(
                          "flex-1 pt-1 text-lg leading-relaxed",
                          done && "line-through",
                        )}
                      >
                        {s.instruction}
                      </p>
                    </button>
                    {stepMinutes != null && (
                      <div className="mt-3 flex items-center gap-2 pl-[3.25rem]">
                        {timerLeft != null && timerLeft > 0 ? (
                          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium tabular-nums text-primary">
                            <Timer className="h-4 w-4" />
                            {fmtTimer(timerLeft)}
                          </div>
                        ) : timerLeft === 0 ? (
                          <div className="flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-accent-foreground">
                            <Timer className="h-4 w-4" />
                            Fertig!
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => startTimer(s.id, stepMinutes)}
                          >
                            <Timer className="h-4 w-4" />
                            Timer {stepMinutes} min
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </div>
        </div>
      )}

      {askGroups && flexGroups.length > 0 && (
        <GroupChoiceDialog
          title={recipe.title}
          pending={flexGroups}
          initial={groupChoices}
          confirmLabel={started ? "Übernehmen" : "Los geht's"}
          onClose={() => setAskGroups(false)}
          onConfirm={(choices) => {
            setGroupChoices((prev) => ({ ...prev, ...choices }));
            setAskGroups(false);
            setStarted(true);
          }}
        />
      )}
    </div>
  );
}
