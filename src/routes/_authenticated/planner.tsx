import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Apple,
  BookOpen,
  Check,

  Clock,
  CookingPot,
  Layers,
  ListChecks,
  Minus,
  Plus,
  ShoppingCart,
  Utensils,
} from "lucide-react";
import { useTracking } from "@/hooks/use-tracking";
import type { TrackableMacroKey } from "@/lib/tracking";
import { ShoppingListGenerateSheet } from "@/components/ShoppingListGenerateSheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchSheet, SearchSheetRow } from "@/components/SearchSheet";
import { MealEntryRow, SlotAddRow } from "@/components/MealSlotCell";
import { MealSlotBorder } from "@/components/MealSlotBorder";

import { EntryDetailSheet } from "@/components/EntryDetailSheet";
import { BatchPlanDialog } from "@/components/BatchPlanDialog";
import { BatchCookSheet } from "@/components/BatchCookSheet";

import {
  batchCookSummaries,
  batchCookWeekQuery,
  batchFormSize,
  createBatch,
  dissolveBatch,
  fixedBatchServings,
  formsForServings,
  isFixedBatch,
  type BatchCookSummary,
} from "@/lib/batch";

import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SuggestionSheet } from "@/components/SuggestionSheet";
import { useServerFn } from "@tanstack/react-start";
import type { AiMealSuggestion } from "@/lib/aiSuggestions.functions";
import { supabase } from "@/integrations/supabase/client";

import { PlannerHero } from "@/components/PlannerHero";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DailyProgressRing } from "@/components/DailyProgressRing";

import { useMealPlan } from "@/hooks/use-meal-plan";
import { useTargetsForDate } from "@/hooks/use-targets-for-date";
import type { NutritionTargets } from "@/lib/nutritionTargets";
import { recipesQuery } from "@/lib/recipes";
import { VariantChips } from "@/components/VariantChips";
import { GroupChoiceDialog } from "@/components/GroupChoiceDialog";
import {
  lastGroupChoice,
  mastersInGroup,
  pendingGroupIngredients,
  rememberGroupChoice,
  type GroupChoices,
  type PendingGroup,
} from "@/lib/productGroups";
import {
  defaultSelection,
  isChoiceComponent,
  selectedVariantId,
  parseVariantSelection,
  type VariantSelection,
} from "@/lib/variants";
import type { RecipeListItem } from "@/types/recipe";
import {
  ingredientSearchText,
  ingredientsMasterQuery,
  matchesViaSubcategory,
} from "@/lib/ingredients-master";
import {
  buildSuggestions,
  calculateSlotTarget,
  slotWeight,
  type Suggestion,
} from "@/lib/mealSuggestions";
import { useIngredientTypicalAmounts } from "@/hooks/use-ingredient-typical-amounts";
import { QuickEntryDialog } from "@/components/QuickEntryDialog";
import {
  GramsOrServingsInput,
  gramsValueOf,
  portionFactorOf,
  type PortionInputValue,
} from "@/components/GramsOrServingsInput";
import { usePortionSummary } from "@/hooks/use-portion-summary";
import { useQuickEntryTemplates } from "@/hooks/use-quick-entry-templates";

import {
  MEAL_SLOTS,
  WEEKDAYS,
  addDays,
  entryDiffersFromSnapshot,
  entryTitle,
  parseGroupChoices,
  formatDayShort,
  isToday,
  startOfWeek,
  toISODate,
  type MacroTotals,
  type MealPlanEntryFull,
  type MealSlot,
} from "@/lib/meal-plan";
import { getColorForProgress } from "@/lib/nutritionScore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "Wochenplaner – Rezepte planen" },
      {
        name: "description",
        content:
          "Plane deine Mahlzeiten für die ganze Woche: Frühstück, Mittag und Abend mit Portionen und Kalorien pro Tag.",
      },
      { property: "og:title", content: "Wochenplaner – Rezepte planen" },
      {
        property: "og:description",
        content: "Mahlzeiten für die Woche planen – mit Portionen und Kalorien pro Tag.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlannerPage,
});

type Target = { date: Date; slot: MealSlot };
type PickerMode = "choose" | "recipe" | "food" | "quick";

function PlannerPage() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  // Aktiver Wochentag als ISO-Datum (yyyy-MM-dd), initial heute.
  const [activeDay, setActiveDay] = useState(() => toISODate(new Date()));
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const {
    days,
    entries,
    getEntries,
    dayTotals,
    weekAverageKcal,
    isLoading,
    planRecipe,
    planFood,
    planQuick,
    update,
    copy,
    remove,
  } = useMealPlan(weekStart);
  const { targetsFor } = useTargetsForDate();
  const { saveTemplate, bumpUse } = useQuickEntryTemplates();

  const [target, setTarget] = useState<Target | null>(null);
  const [mode, setMode] = useState<PickerMode | null>(null);
  const [suggestTarget, setSuggestTarget] = useState<Target | null>(null);
  // Zieltag/-slot wird mitgespeichert, weil das Schließen des SearchSheets
  // `target` zurücksetzt, die Mengeneingabe aber danach kommt.
  const [foodPending, setFoodPending] = useState<{
    id: string;
    name: string;
    unit: string;
    target: Target;
  } | null>(null);
  const [optionsEntry, setOptionsEntry] = useState<MealPlanEntryFull | null>(null);
  const [servingsEntry, setServingsEntry] = useState<MealPlanEntryFull | null>(null);
  const [amountEntry, setAmountEntry] = useState<MealPlanEntryFull | null>(null);
  // Temporärer Zwischenspeicher (nur für diese Sitzung, kein Persistieren).
  const [clipboard, setClipboard] = useState<MealPlanEntryFull | null>(null);
  const [moveEntry, setMoveEntry] = useState<MealPlanEntryFull | null>(null);
  const [quickEditEntry, setQuickEditEntry] = useState<MealPlanEntryFull | null>(null);
  // Varianten- und Sortenauswahl vor dem Einplanen (ein Dialog).
  const [variantPending, setVariantPending] = useState<{
    recipe: RecipeListItem;
    target: Target;
  } | null>(null);
  // Mengeneingabe (Portionen oder Gramm) vor dem Einplanen.
  const [portionPending, setPortionPending] = useState<{
    recipe: RecipeListItem;
    target: Target;
    selection: VariantSelection | null;
    choices: GroupChoices | null;
  } | null>(null);
  // Sorte eines bestehenden Eintrags ändern (wirkt nur auf diesen Snapshot).
  const [groupEditEntry, setGroupEditEntry] = useState<MealPlanEntryFull | null>(null);
  // Batch-/Vorkoch-Verknüpfung.
  const [batchEntry, setBatchEntry] = useState<MealPlanEntryFull | null>(null);
  const { user } = useAuth();
  const qc = useQueryClient();

  function refreshPlan() {
    void qc.invalidateQueries({ queryKey: ["meal-plan"] });
    void qc.invalidateQueries({ queryKey: ["daily-totals"] });
    void qc.invalidateQueries({ queryKey: ["batch-cook-week"] });
  }


  async function handleCreateBatch(
    entry: MealPlanEntryFull,
    dates: string[],
    servingsPerDay: number,
    cookDate: string,
  ) {
    if (!user) return;
    try {
      await createBatch({
        entry,
        userId: user.id,
        targets: dates.map((d) => ({ date: d, slot: entry.meal_slot as MealSlot })),
        servingsPerDay,
        cookDate,
      });
      refreshPlan();
      toast.success("Batch angelegt", { description: "Koch-Tag und Reste sind verknüpft." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Verknüpfen");
    }
  }

  async function handleDissolveBatch(entry: MealPlanEntryFull) {
    if (!entry.batch_group_id) return;
    try {
      await dissolveBatch(entry.batch_group_id);
      refreshPlan();
      toast.success("Verknüpfung gelöst");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Lösen");
    }
  }

  const needsRecipes = mode === "recipe" || !!suggestTarget || !!variantPending || !!portionPending;
  const needsFoods = mode === "food" || !!suggestTarget;
  const { data: recipes = [] } = useQuery({ ...recipesQuery(), enabled: needsRecipes });
  const { data: foods = [] } = useQuery({
    ...ingredientsMasterQuery(),
    enabled: needsFoods,
  });

  const remaining = useMemo(() => {
    const targets = targetsFor(suggestTarget?.date ? toISODate(suggestTarget.date) : "");
    if (!suggestTarget || !targets) return null;
    const openSlots = MEAL_SLOTS.filter(
      (s) => s === suggestTarget.slot || getEntries(suggestTarget.date, s).length === 0,
    ).map((s) => ({ slot: s as string, weight: slotWeight(s) }));
    return calculateSlotTarget(
      {
        calories: targets.calories,
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
        fiber_g: targets.fiber_g,
      },
      dayTotals(suggestTarget.date),
      openSlots,
      suggestTarget.slot,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestTarget, targetsFor, dayTotals]);

  const { data: typicalAmounts } = useIngredientTypicalAmounts(!!suggestTarget);

  const suggestions = useMemo(() => {
    if (!remaining) return { recipes: [], supplements: [] };
    return buildSuggestions({
      remaining,
      recipes,
      foods,
      slot: suggestTarget?.slot ?? null,
      typicalAmounts,
      limit: 5,
    });
  }, [remaining, recipes, foods, suggestTarget, typicalAmounts]);

  /* KI-Vorschläge sind deaktiviert: keine externen Aufrufe, immer leere Liste. */
  const aiSuggestions: AiMealSuggestion[] = [];

  /** KI-Idee als Schnelleintrag übernehmen (geschätzte Werte). */
  function pickAiSuggestion(s: AiMealSuggestion) {
    if (!target) return;
    planQuick.mutate({
      date: target.date,
      slot: target.slot,
      name: s.name,
      calories: s.estimated_kcal,
      protein_g: s.estimated_protein_g,
      carbs_g: s.estimated_carbs_g,
      fat_g: s.estimated_fat_g,
      fiber_g: s.estimated_fiber_g,
    });
    setSuggestTarget(null);
    setTarget(null);
  }

  /**
   * "Haferflocken 60 g" → { name: "Haferflocken", amount: 60, unit: "g" }.
   * Ohne Mengenangabe wird eine grobe Schätzmenge gesetzt, die der Nutzer anpassen kann.
   */
  function parseIngredientLine(raw: string) {
    const text = raw.trim().replace(/^[-•*]\s*/, "");
    const m = text.match(
      /^(?:(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|el|tl|stk|stück|prise|dose|becher|scheibe|scheiben)?\s+)?(.+?)(?:\s*[,(]?\s*(?:ca\.?\s*)?(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|el|tl|stk|stück)\)?)?$/i,
    );
    const name = (m?.[3] ?? text).trim();
    const amountRaw = m?.[1] ?? m?.[4];
    const unitRaw = (m?.[2] ?? m?.[5] ?? "").toLowerCase();
    const amount = amountRaw ? Number(amountRaw.replace(",", ".")) : null;
    const unit = unitRaw === "stück" ? "stk" : unitRaw || null;
    return { name, amount, unit };
  }

  /** KI-Idee als eigenes Rezept speichern (später verfeinerbar). */
  async function saveAiSuggestionAsRecipe(s: AiMealSuggestion) {
    if (!user) return;
    const { data, error } = await supabase
      .from("recipes")
      .insert({
        user_id: user.id,
        title: s.name,
        description: s.description || null,
        servings: 1,
        nutrition_mode: "simple",
        calories: s.estimated_kcal,
        protein_g: s.estimated_protein_g,
        carbs_g: s.estimated_carbs_g,
        fat_g: s.estimated_fat_g,
        fiber_g: s.estimated_fiber_g,
        categories: [],
      })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Rezept konnte nicht gespeichert werden");
      return;
    }
    // Zutatenzeilen aus der Vorschlagsliste anlegen (grobe Schätzmengen, anpassbar).
    const lines = (s.main_ingredients ?? []).filter((x) => x.trim().length > 0);
    if (lines.length > 0) {
      const rows = lines.map((line, i) => {
        const parsed = parseIngredientLine(line);
        const match = foods.find(
          (f) => f.name.trim().toLowerCase() === parsed.name.toLowerCase(),
        );
        const unit = parsed.unit ?? match?.unit ?? "g";
        return {
          recipe_id: data.id,
          name: match?.name ?? parsed.name,
          amount: parsed.amount ?? (unit === "stk" ? 1 : 100),
          unit,
          sort_order: i,
          ingredient_master_id: match?.id ?? null,
        };
      });
      const { error: ingErr } = await supabase.from("ingredients").insert(rows);
      if (ingErr) toast.error("Zutaten konnten nicht angelegt werden");
    }

    void qc.invalidateQueries({ queryKey: ["recipes"] });
    toast.success("Als Rezept gespeichert", { description: "Nährwerte sind Schätzungen." });
    setSuggestTarget(null);
    setTarget(null);
    void navigate({ to: "/recipes/$id/edit", params: { id: data.id } });
  }


  function openAdd(date: Date, slot: MealSlot) {
    setTarget({ date, slot });
    setMode("choose");
  }

  function openSuggest(date: Date, slot: MealSlot) {
    setTarget({ date, slot });
    setSuggestTarget({ date, slot });
  }

  function pickSuggestion(s: Suggestion) {
    if (!target) return;
    if (s.kind === "recipe") {
      planRecipe.mutate({
        date: target.date,
        slot: target.slot,
        recipeId: s.id,
        servings: s.servings ?? 1,
      });
    } else {
      planFood.mutate({
        date: target.date,
        slot: target.slot,
        ingredientId: s.id,
        amount: s.amount ?? 1,
        unit: s.unit ?? "g",
      });
    }
    setSuggestTarget(null);
    setTarget(null);
  }

  /** Nach Varianten-/Sortenwahl folgt die Mengeneingabe. */
  function planRecipeEntry(
    r: RecipeListItem,
    t: Target,
    selection: VariantSelection | null,
    groupChoices: GroupChoices | null = null,
  ) {
    setPortionPending({ recipe: r, target: t, selection, choices: groupChoices });
  }

  /** Flexible Zutaten (Produktgruppen) eines geplanten Rezepts. */
  function entryFlexGroups(entry: MealPlanEntryFull | null): PendingGroup[] {
    if (!entry?.recipe) return [];
    return pendingGroupIngredients(entry.recipe, parseVariantSelection(entry.selected_variant_ids));
  }

  function renderSlot(day: Date, slot: MealSlot) {
    const entries = getEntries(day, slot);
    return (
      <div key={slot} className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {slot}
        </p>
        {entries.length > 0 && (
          <MealSlotBorder>
            {entries.map((e) => (
              <MealEntryRow key={e.id} entry={e} onClick={() => setOptionsEntry(e)} />
            ))}
          </MealSlotBorder>
        )}

        <SlotAddRow
          onAdd={() => openAdd(day, slot)}
          onSuggest={() => openSuggest(day, slot)}
          onPaste={
            clipboard
              ? () =>
                  copy.mutate({ entry: clipboard, dates: [toISODate(day)], slot })
              : undefined
          }
        />
      </div>
    );
  }

  /**
   * Wochen-Ziel = Durchschnitt der je Tag gültigen Ziel-Werte, damit eine
   * Ziel-Änderung mitten in der Woche vergangene Tage nicht rückwirkend
   * neu bewertet.
   */
  const weekTargets = useMemo(() => {
    const list = days
      .map((d) => targetsFor(toISODate(d)))
      .filter((t): t is NonNullable<typeof t> => t != null);
    if (list.length === 0) return null;
    const avg = (
      key: "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sugar_max_g",
    ) => Math.round(list.reduce((sum, t) => sum + t[key], 0) / list.length);
    return {
      bmr: 0,
      tdee: 0,
      calories: avg("calories"),
      protein_g: avg("protein_g"),
      carbs_g: avg("carbs_g"),
      fat_g: avg("fat_g"),
      fiber_g: avg("fiber_g"),
      sugar_max_g: avg("sugar_max_g"),
      manual: true,
    };

  }, [days, targetsFor]);

  const activeDate = useMemo(() => {
    const found = days.find((d) => toISODate(d) === activeDay);
    return found ?? days[0] ?? new Date();
  }, [days, activeDay]);

  const activeDayHasEntries = useMemo(
    () => MEAL_SLOTS.some((slot) => getEntries(activeDate, slot).length > 0),
    [activeDate, getEntries],
  );

  // Koch-Tage können in einer anderen Woche als die Verzehrtage liegen –
  // daher separat nach batch_cook_date laden.
  const { data: cookEntries = [] } = useQuery(batchCookWeekQuery(weekStart));
  const cookSummaries = useMemo(
    () => batchCookSummaries(cookEntries, toISODate(activeDate)),
    [cookEntries, activeDate],
  );



  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Planer</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShoppingOpen(true)}
            aria-label="Einkaufsliste erstellen"
          >
            <ShoppingCart className="mr-1 h-4 w-4" /> Einkaufsliste
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="Einkaufsliste öffnen">
            <Link to="/shopping-list">
              <ListChecks className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Planer-Header: klebt direkt unter dem globalen App-Header (h-16) */}
      <div className="sticky top-16 z-20 -mx-4 border-b border-border/60 bg-background px-4 pb-2 pt-2">
        <PlannerHero
          weekStart={weekStart}
          days={days}
          activeDay={toISODate(activeDate)}
          onSelectDay={setActiveDay}
          onPrevWeek={() => setWeekStart((w) => addDays(w, -7))}
          onNextWeek={() => setWeekStart((w) => addDays(w, 7))}
          onToday={() => {
            setWeekStart(startOfWeek(new Date()));
            setActiveDay(toISODate(new Date()));
          }}
          weekAverageKcal={weekAverageKcal}
          weekTargets={weekTargets}
          targetsFor={targetsFor}
          dayTotals={dayTotals}
          forceCompact={!activeDayHasEntries}
        />
      </div>


      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <section key={toISODate(activeDate)} className="min-h-[calc(100vh-180px)] space-y-2">
          <DayHeading
            day={activeDate}
            totals={dayTotals(activeDate)}
            targets={targetsFor(toISODate(activeDate))}
          />
          <BatchCookNotes summaries={cookSummaries} />
          <div className="space-y-2">{MEAL_SLOTS.map((slot) => renderSlot(activeDate, slot))}</div>
        </section>
      )}

      <ShoppingListGenerateSheet
        open={shoppingOpen}
        onOpenChange={setShoppingOpen}
        weekStart={weekStart}
      />


      {/* Art des Eintrags wählen */}
      <Dialog
        open={mode === "choose"}
        onOpenChange={(v) => {
          if (!v) {
            setMode(null);
            setTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {target ? `${target.slot} · ${formatDayShort(target.date)}` : "Hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" onClick={() => setMode("recipe")}>
              <BookOpen className="mr-2 h-4 w-4" /> Rezept
            </Button>
            <Button variant="secondary" onClick={() => setMode("food")}>
              <Apple className="mr-2 h-4 w-4" /> Lebensmittel
            </Button>
            <Button variant="secondary" onClick={() => setMode("quick")}>
              <Utensils className="mr-2 h-4 w-4" /> Schnelleintrag
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rezept auswählen */}
      <SearchSheet
        open={mode === "recipe"}
        onOpenChange={(v) => {
          if (!v) {
            setMode(null);
            setTarget(null);
          }
        }}
        title={target ? `${target.slot} · ${formatDayShort(target.date)}` : "Rezept wählen"}
        placeholder="Rezept suchen…"
        items={recipes}
        getSearchText={(r) => r.title}
        emptyLabel="Keine Rezepte vorhanden"
        onSelect={(r) => {
          if (!target) return;
          const t = target;
          setMode(null);
          setTarget(null);
          const hasChoice = (r.components ?? []).some(isChoiceComponent);
          const hasGroups = pendingGroupIngredients(r, defaultSelection(r.components)).length > 0;
          if (hasChoice || hasGroups) setVariantPending({ recipe: r, target: t });
          else planRecipeEntry(r, t, null, null);
        }}
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

      {/* Lebensmittel auswählen */}
      <SearchSheet
        open={mode === "food"}
        onOpenChange={(v) => {
          if (!v) {
            setMode(null);
            setTarget(null);
          }
        }}
        title={target ? `${target.slot} · ${formatDayShort(target.date)}` : "Lebensmittel wählen"}
        placeholder="Lebensmittel suchen…"
        items={foods}
        getSearchText={ingredientSearchText}
        emptyLabel="Keine Lebensmittel vorhanden"
        onSelect={(f) => {
          if (!target) return;
          setFoodPending({ id: f.id, name: f.name, unit: f.unit, target });
          setMode(null);
        }}
        renderItem={(f, ctx) => (
          <SearchSheetRow onClick={ctx.onSelect} selected={ctx.selected}>
            <Apple className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                {f.name}
                {f.subcategory && matchesViaSubcategory(f, ctx.query) && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    · {f.subcategory}
                  </span>
                )}
              </span>
              <span className="block text-xs text-muted-foreground">
                {f.calories != null
                  ? `${f.calories} kcal / ${f.unit === "Stück" ? "Stück" : `100 ${f.unit}`}`
                  : f.unit}
              </span>
            </span>
          </SearchSheetRow>
        )}

      />

      {/* Menge für Lebensmittel */}
      {foodPending && (
        <AmountDialog
          title={foodPending.name}
          unit={foodPending.unit}
          initial={foodPending.unit === "Stück" ? 1 : 100}
          onClose={() => {
            setFoodPending(null);
            setTarget(null);
          }}
          onSave={(amount, unit) => {
            planFood.mutate({
              date: foodPending.target.date,
              slot: foodPending.target.slot,
              ingredientId: foodPending.id,
              amount,
              unit,
            });
            setFoodPending(null);
            setTarget(null);
          }}
        />
      )}

      {/* Schnelleintrag */}
      {mode === "quick" && target && (
        <QuickEntryDialog
          title={`Schnelleintrag · ${target.slot} ${formatDayShort(target.date)}`}
          onClose={() => {
            setMode(null);
            setTarget(null);
          }}
          onSubmit={(v) => {
            planQuick.mutate({
              date: target.date,
              slot: target.slot,
              name: v.name,
              calories: v.calories,
              protein_g: v.protein_g,
              carbs_g: v.carbs_g,
              fat_g: v.fat_g,
              fiber_g: v.fiber_g,
              sugar_g: v.sugar_g,
            });
            if (v.saveAsTemplate) {
              saveTemplate.mutate({
                name: v.name,
                calories: v.calories,
                protein_g: v.protein_g,
                carbs_g: v.carbs_g,
                fat_g: v.fat_g,
                fiber_g: v.fiber_g,
                sugar_g: v.sugar_g,
              });
            } else if (v.templateId) {
              bumpUse.mutate(v.templateId);
            }
            setMode(null);
            setTarget(null);
          }}
        />
      )}

      {/* Schnelleintrag bearbeiten */}
      {quickEditEntry && (
        <QuickEntryDialog
          title="Schnelleintrag bearbeiten"
          submitLabel="Speichern"
          showTemplateToggle={false}
          initial={{
            name: quickEditEntry.quick_entry_name ?? "",
            calories:
              quickEditEntry.quick_entry_calories != null
                ? Number(quickEditEntry.quick_entry_calories)
                : undefined,
            protein_g:
              quickEditEntry.quick_entry_protein_g != null
                ? Number(quickEditEntry.quick_entry_protein_g)
                : null,
            carbs_g:
              quickEditEntry.quick_entry_carbs_g != null
                ? Number(quickEditEntry.quick_entry_carbs_g)
                : null,
            fat_g:
              quickEditEntry.quick_entry_fat_g != null
                ? Number(quickEditEntry.quick_entry_fat_g)
                : null,
            fiber_g:
              quickEditEntry.quick_entry_fiber_g != null
                ? Number(quickEditEntry.quick_entry_fiber_g)
                : null,
            sugar_g:
              quickEditEntry.quick_entry_sugar_g != null
                ? Number(quickEditEntry.quick_entry_sugar_g)
                : null,
          }}
          onClose={() => setQuickEditEntry(null)}
          onSubmit={(v) => {
            update.mutate({
              id: quickEditEntry.id,
              quick_entry_name: v.name,
              quick_entry_calories: v.calories,
              quick_entry_protein_g: v.protein_g,
              quick_entry_carbs_g: v.carbs_g,
              quick_entry_fat_g: v.fat_g,
              quick_entry_fiber_g: v.fiber_g,
              quick_entry_sugar_g: v.sugar_g,
            });
            setQuickEditEntry(null);
          }}
        />
      )}

      {/* Vorschläge */}
      <SuggestionSheet
        open={!!suggestTarget}
        onOpenChange={(v) => {
          if (!v) {
            setSuggestTarget(null);
            setTarget(null);
          }
        }}
        title={suggestTarget ? `${suggestTarget.slot} · ${formatDayShort(suggestTarget.date)}` : ""}
        remaining={remaining}
        suggestions={suggestions}
        aiSuggestions={aiSuggestions}
        aiLoading={false}
        aiError={null}
        onPick={pickSuggestion}
        onPickAi={pickAiSuggestion}
        onSaveAiAsRecipe={(s) => void saveAiSuggestionAsRecipe(s)}

        onManual={() => {
          setSuggestTarget(null);
          setMode("choose");
        }}
      />

      {/* Snapshot-Details des Eintrags */}
      {optionsEntry && (
        <EntryDetailSheet
          entry={optionsEntry}
          hasGroups={entryFlexGroups(optionsEntry).length > 0}
          onClose={() => setOptionsEntry(null)}
          onEditServings={() => {
            setServingsEntry(optionsEntry);
            setOptionsEntry(null);
          }}
          onEditAmount={() => {
            setAmountEntry(optionsEntry);
            setOptionsEntry(null);
          }}
          onEditQuick={() => {
            setQuickEditEntry(optionsEntry);
            setOptionsEntry(null);
          }}
          onEditGroups={() => {
            setGroupEditEntry(optionsEntry);
            setOptionsEntry(null);
          }}
          onMove={() => {
            setMoveEntry(optionsEntry);
            setOptionsEntry(null);
          }}
          onCopy={() => {
            setClipboard(optionsEntry);
            setOptionsEntry(null);
            toast.success("Kopiert", {
              description: "Jetzt Tag wählen und im Slot auf „Einfügen“ tippen.",
            });
          }}
          onRemove={() => {
            remove.mutate(optionsEntry.id);
            setOptionsEntry(null);
          }}
          onBatch={() => {
            setBatchEntry(optionsEntry);
            setOptionsEntry(null);
          }}
          onDissolveBatch={() => {
            void handleDissolveBatch(optionsEntry);
            setOptionsEntry(null);
          }}
        />
      )}

      {/* Vorkochen: Koch-Tag + verknüpfte Rest-Tage */}
      {batchEntry && (
        <BatchPlanDialog
          entry={batchEntry}
          days={days}
          initialTargets={
            batchEntry.batch_group_id
              ? entries
                  .filter((e) => e.batch_group_id === batchEntry.batch_group_id)
                  .map((e) => e.date)
              : []
          }
          onClose={() => setBatchEntry(null)}
          onConfirm={(dates, servingsPerDay, cookDate) => {
            void handleCreateBatch(batchEntry, dates, servingsPerDay, cookDate);
            setBatchEntry(null);
          }}
          onDissolve={() => {
            void handleDissolveBatch(batchEntry);
            setBatchEntry(null);
          }}
        />
      )}


      {servingsEntry && (
        <ServingsDialog
          entry={servingsEntry}
          onClose={() => setServingsEntry(null)}
          onSave={(servings, inputMode, grams) => {
            update.mutate({
              id: servingsEntry.id,
              servings,
              input_mode: inputMode,
              input_grams_value: grams,
            });
            setServingsEntry(null);
          }}
        />
      )}

      {amountEntry && (
        <AmountDialog
          title={amountEntry.ingredient?.name ?? "Menge"}
          unit={amountEntry.unit ?? amountEntry.ingredient?.unit ?? "g"}
          initial={amountEntry.amount != null ? Number(amountEntry.amount) : 100}
          onClose={() => setAmountEntry(null)}
          onSave={(amount, unit) => {
            update.mutate({ id: amountEntry.id, amount, unit });
            setAmountEntry(null);
          }}
        />
      )}

      {/* Varianten + Sorten wählen */}
      {variantPending && (
        <VariantSelectDialog
          recipe={variantPending.recipe}
          onClose={() => setVariantPending(null)}
          onConfirm={(selection, choices) => {
            planRecipeEntry(variantPending.recipe, variantPending.target, selection, choices);
            setVariantPending(null);
          }}
        />
      )}

      {/* Menge (Portionen oder Gramm) wählen */}
      {portionPending && (
        <PortionPlanDialog
          recipe={portionPending.recipe}
          selection={portionPending.selection}
          onClose={() => setPortionPending(null)}
          onConfirm={(servings, mode_, grams) => {
            const p = portionPending;
            planRecipe.mutate({
              date: p.target.date,
              slot: p.target.slot,
              recipeId: p.recipe.id,
              servings,
              selectedVariantIds:
                p.selection && Object.keys(p.selection).length > 0 ? p.selection : null,
              groupChoices: p.choices && Object.keys(p.choices).length > 0 ? p.choices : null,
              inputMode: mode_,
              inputGramsValue: grams,
            });
            setPortionPending(null);
          }}
        />
      )}

      {/* Sorte eines bestehenden Eintrags ändern */}
      {groupEditEntry && (
        <GroupChoiceDialog
          title={entryTitle(groupEditEntry)}
          pending={entryFlexGroups(groupEditEntry)}
          initial={parseGroupChoices(groupEditEntry.group_choices)}
          confirmLabel="Speichern"
          onClose={() => setGroupEditEntry(null)}
          onConfirm={(choices) => {
            update.mutate({ id: groupEditEntry.id, group_choices: choices });
            setGroupEditEntry(null);
          }}
        />
      )}

      {moveEntry && (
        <MoveDialog
          entry={moveEntry}
          days={days}
          onClose={() => setMoveEntry(null)}
          onSave={(date, slot) => {
            update.mutate({ id: moveEntry.id, date, meal_slot: slot });
            setMoveEntry(null);
          }}
        />
      )}
    </div>
  );
}

/** Reihenfolge und Kurzlabels der Makro-Zeile im Tages-Block. */
const MACRO_ROW: { key: TrackableMacroKey; label: string }[] = [
  { key: "protein_g", label: "P" },
  { key: "carbs_g", label: "KH" },
  { key: "fat_g", label: "F" },
  { key: "fiber_g", label: "BS" },
];

function DayHeading({
  day,
  totals,
  targets,
  compact,
}: {
  day: Date;
  totals: MacroTotals | null;
  targets: NutritionTargets | null;
  compact?: boolean;
}) {
  const dow = WEEKDAYS[(day.getDay() + 6) % 7];
  const kcal = totals ? Math.round(totals.calories) : 0;
  const { tracking } = useTracking();
  // Deaktivierte Kategorien werden komplett ausgeblendet (kein Platzhalter).
  const activeMacros = MACRO_ROW.filter((m) => tracking[m.key]);
  return (
    <div className={cn("space-y-1 border-b border-border pb-1.5", compact && "text-center")}>
      <div className={cn("flex items-center gap-2", compact && "justify-center")}>
        <span className={cn("text-sm font-semibold", isToday(day) && "text-primary")}>
          {dow} {formatDayShort(day)}
        </span>
        {targets && <DailyProgressRing value={kcal} target={targets.calories} size={34} />}
      </div>
      <p
        className={cn("text-[11px] font-medium tabular-nums", !targets && "text-muted-foreground")}
        style={targets ? { color: getColorForProgress(kcal, targets.calories) } : undefined}
      >
        {targets ? `${kcal} / ${targets.calories} kcal` : `${kcal} kcal`}
      </p>
      {targets && <RemainingKcal value={kcal} target={targets.calories} />}
      {targets && (
        <MacroGrid
          items={[
            ...activeMacros.map(({ key, label }) => ({
              key,
              label,
              value: totals?.[key] ?? 0,
              target: targets[key],
              isMax: false,
            })),
            ...(tracking.sugar_g
              ? [
                  {
                    key: "sugar_g",
                    label: "Z",
                    value: totals?.sugar_g ?? 0,
                    target: targets.sugar_max_g,
                    isMax: true,
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}

type MacroGridItem = {
  key: string;
  label: string;
  value: number;
  target: number;
  /** true = Obergrenze (Zucker): grün unterhalb, Warnfarbe darüber. */
  isMax: boolean;
};

/**
 * Makro-Zeile im Tages-Block: einheitliches Raster mit Kürzel-Labels
 * (P/KH/F/BS/Z), immer 3 Zellen pro Zeile und zentrierter letzter Zeile –
 * unabhängig davon, wie viele Kategorien aktiv getrackt werden.
 */
function MacroGrid({ items }: { items: MacroGridItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
      {items.map((item) => (
        <MacroCell
          key={item.key}
          label={item.label}
          value={item.value}
          target={item.target}
          isMax={item.isMax}
        />
      ))}
    </div>
  );
}


/** „noch X kcal übrig" / „X kcal über dem Ziel" – nur Tageswert, nicht Wochen-Ø. */
function RemainingKcal({ value, target }: { value: number; target: number }) {
  const diff = target - value;
  if (diff === 0) {
    return <p className="text-[10px] text-muted-foreground">→ Ziel erreicht</p>;
  }
  if (diff > 0) {
    return (
      <p className="text-[10px] text-muted-foreground">→ noch {diff} kcal übrig</p>
    );
  }
  return (
    <p className="text-[10px] font-semibold" style={{ color: overColor(value, target) }}>
      → {Math.abs(diff)} kcal über dem Ziel
    </p>
  );
}

/** Warnfarbe bei Überschreitung: orange bis +30 %, darüber rot. */
function overColor(value: number, target: number): string {
  if (target <= 0) return "hsl(0, 75%, 48%)";
  const ratio = value / target;
  if (ratio <= 1.3) return "hsl(38, 92%, 45%)";
  return "hsl(0, 75%, 48%)";
}

/**
 * Eine Rasterzelle: Kürzel, „54/139g" und Mini-Fortschrittsleiste.
 * Feste Zellbreite → gleichmäßiges Raster, letzte Zeile bleibt zentriert.
 */
function MacroCell({ label, value, target, isMax }: Omit<MacroGridItem, "key">) {
  const rounded = Math.round(value);
  const over = target > 0 && rounded > target;
  // Einheitlicher Korridor für alle Makros: 80–110 % = grün.
  // Bei Obergrenzen (Zucker) bleibt jede Überschreitung eine Warnfarbe.
  const col = isMax
    ? over
      ? overColor(rounded, target)
      : "hsl(142, 65%, 40%)"
    : getColorForProgress(rounded, target);
  const pct = target > 0 ? Math.min(100, Math.round((rounded / target) * 100)) : 0;

  return (
    <div className="w-[86px] shrink-0 space-y-0.5">
      <div className="flex items-center justify-center gap-1 leading-tight">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] tabular-nums" style={{ color: col }}>
          {rounded}/{target}g
        </span>
      </div>
      <span
        aria-hidden
        className="block h-1 w-full overflow-hidden rounded-full bg-muted"
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: col }}
        />
      </span>
    </div>
  );
}


function ServingsDialog({
  entry,
  onClose,
  onSave,
}: {
  entry: MealPlanEntryFull;
  onClose: () => void;
  onSave: (servings: number, mode: "servings" | "grams", grams: number | null) => void;
}) {
  const selection = parseVariantSelection(entry.selected_variant_ids);
  const summary = usePortionSummary(entry.recipe, selection);
  const [value, setValue] = useState<PortionInputValue>(() => ({
    mode: entry.input_mode === "grams" ? "grams" : "servings",
    servings: entry.servings != null ? Number(entry.servings) : (entry.recipe?.servings ?? 1),
    grams:
      entry.input_grams_value != null ? String(Math.round(Number(entry.input_grams_value))) : "",
  }));
  const factor = portionFactorOf(value, summary);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Menge</DialogTitle>
        </DialogHeader>
        <GramsOrServingsInput value={value} onChange={setValue} summary={summary} />
        <FixedBatchNote recipe={entry.recipe} servings={factor} />
        <Button
          disabled={factor == null}
          onClick={() => factor != null && onSave(factor, value.mode, gramsValueOf(value))}
        >
          Speichern
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Hinweis für feste Chargen: es werden immer ganze Formen gekocht. */
function FixedBatchNote({
  recipe,
  servings,
}: {
  recipe: { is_fixed_batch?: boolean | null; batch_servings?: number | string | null; servings?: number | null } | null | undefined;
  servings: number | null;
}) {
  if (!isFixedBatch(recipe) || servings == null || servings <= 0) return null;
  const formSize = batchFormSize(recipe);
  const forms = formsForServings(servings, formSize);
  const total = fixedBatchServings(servings, formSize);
  return (
    <p className="text-xs text-muted-foreground">
      Feste Form: {forms} × {formSize} Portionen werden gekocht ({total} gesamt). Reste kannst du
      danach als „Vorgekocht" auf weitere Tage verteilen.
    </p>
  );
}

/** Kompakte Info an Koch-Tagen: Gesamtzeit und Reichweite des Batches. */
function BatchCookNotes({ summaries }: { summaries: BatchCookSummary[] }) {
  const [active, setActive] = useState<BatchCookSummary | null>(null);
  const current = active ? (summaries.find((s) => s.groupId === active.groupId) ?? null) : null;
  if (summaries.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {summaries.map((s) => (
        <button
          key={s.groupId}
          type="button"
          onClick={() => setActive(s)}
          className={cn(
            "flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-left text-xs transition hover:bg-primary/10",
            s.cookedAt ? "border-primary/40 bg-primary/10" : "border-primary/30 bg-primary/5",
          )}
        >
          <span className="flex items-center gap-1 font-semibold text-primary">
            {s.cookedAt ? <Check className="h-3.5 w-3.5" /> : <CookingPot className="h-3.5 w-3.5" />}
            {s.cookedAt ? "Gekocht" : "Koch-Tag"}
          </span>
          <span className="min-w-0 truncate font-medium text-foreground">{s.title}</span>
          {s.totalMinutes != null && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" /> Gesamtzeit: {s.totalMinutes} Min.
            </span>
          )}
          <span className="text-muted-foreground">
            {s.totalServings} Portionen
            {s.followUpDays > 0
              ? ` · reicht für ${s.followUpDays} Folgetag${s.followUpDays === 1 ? "" : "e"}`
              : ""}
          </span>
        </button>
      ))}
      {current && <BatchCookSheet summary={current} onClose={() => setActive(null)} />}
    </div>
  );
}



/** Mengeneingabe (Portionen oder Gramm) beim Einplanen eines Rezepts. */
function PortionPlanDialog({
  recipe,
  selection,
  onClose,
  onConfirm,
}: {
  recipe: RecipeListItem;
  selection: VariantSelection | null;
  onClose: () => void;
  onConfirm: (servings: number, mode: "servings" | "grams", grams: number | null) => void;
}) {
  const summary = usePortionSummary(recipe, selection);
  const [value, setValue] = useState<PortionInputValue>(() => ({
    mode: "servings",
    servings: recipe.servings ?? 1,
    grams: "",
  }));
  const factor = portionFactorOf(value, summary);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="truncate">{recipe.title}</DialogTitle>
        </DialogHeader>
        <GramsOrServingsInput value={value} onChange={setValue} summary={summary} />
        <FixedBatchNote recipe={recipe} servings={factor} />
        <Button
          disabled={factor == null}
          onClick={() => factor != null && onConfirm(factor, value.mode, gramsValueOf(value))}
        >
          Einplanen
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Mengeneingabe für einzelne Lebensmittel. */
function AmountDialog({
  title,
  unit,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  unit: string;
  initial: number;
  onClose: () => void;
  onSave: (amount: number, unit: string) => void;
}) {
  const [value, setValue] = useState(String(initial));
  const num = Number(value.replace(",", "."));
  const valid = Number.isFinite(num) && num > 0;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Menge"
            autoFocus
          />
          <span className="w-14 shrink-0 text-sm text-muted-foreground">{unit}</span>
        </div>
        <Button disabled={!valid} onClick={() => valid && onSave(num, unit)}>
          Speichern
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  entry,
  days,
  onClose,
  onSave,
}: {
  entry: MealPlanEntryFull;
  days: Date[];
  onClose: () => void;
  onSave: (date: string, slot: MealSlot) => void;
}) {
  const [date, setDate] = useState(entry.date);
  const [slot, setSlot] = useState<MealSlot>(entry.meal_slot as MealSlot);
  const options = useMemo(
    () =>
      days.map((d) => ({
        value: toISODate(d),
        label: `${WEEKDAYS[(d.getDay() + 6) % 7]} ${formatDayShort(d)}`,
      })),
    [days],
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Verschieben</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={date} onValueChange={setDate}>
            <SelectTrigger>
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={slot} onValueChange={(v) => setSlot(v as MealSlot)}>
            <SelectTrigger>
              <SelectValue placeholder="Mahlzeit" />
            </SelectTrigger>
            <SelectContent>
              {MEAL_SLOTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="w-full" onClick={() => onSave(date, slot)}>
            Verschieben
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Auswahl der Varianten und Sorten vor dem Einplanen eines Rezepts. */
function VariantSelectDialog({
  recipe,
  onClose,
  onConfirm,
}: {
  recipe: RecipeListItem;
  onClose: () => void;
  onConfirm: (selection: VariantSelection, choices: GroupChoices) => void;
}) {
  const { data: masters = [] } = useQuery(ingredientsMasterQuery());
  const choiceComponents = (recipe.components ?? []).filter(isChoiceComponent);
  const [selection, setSelection] = useState<VariantSelection>(() =>
    defaultSelection(recipe.components),
  );
  const [choices, setChoices] = useState<GroupChoices>({});

  const pending = useMemo(() => pendingGroupIngredients(recipe, selection), [recipe, selection]);

  /** Empfehlung je Gruppe: zuletzt gewählte Sorte, sonst erste verfügbare. */
  const recommended = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const p of pending) {
      const group = p.ingredient.product_group ?? "";
      const list = mastersInGroup(masters, group);
      const last = lastGroupChoice(group);
      out[p.ingredient.id] = (last && list.some((m) => m.id === last) ? last : list[0]?.id) ?? null;
    }
    return out;
  }, [pending, masters]);

  const effective = useMemo(() => {
    const out: GroupChoices = {};
    for (const p of pending) {
      const picked = choices[p.ingredient.id] ?? recommended[p.ingredient.id];
      if (picked) out[p.ingredient.id] = picked;
    }
    return out;
  }, [pending, choices, recommended]);

  const complete = pending.every((p) => !!effective[p.ingredient.id]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[85dvh] max-w-sm flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{recipe.title}</DialogTitle>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          {choiceComponents.map((c) => (
            <div key={c.id} className="space-y-1.5">
              <p className="text-sm font-medium">{c.name}</p>
              <VariantChips
                component={c}
                selectedId={selectedVariantId(c, selection)}
                onSelect={(variantId) => setSelection((s) => ({ ...s, [c.id]: variantId }))}
              />
            </div>
          ))}

          {pending.map((p) => {
            const group = p.ingredient.product_group ?? "";
            const list = mastersInGroup(masters, group);
            const active = effective[p.ingredient.id] ?? null;
            const tip = recommended[p.ingredient.id];
            return (
              <div key={p.ingredient.id} className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate">Sorte · {group}</span>
                  {p.ingredient.amount != null && (
                    <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
                      {Number(p.ingredient.amount)} {p.ingredient.unit ?? ""}
                    </span>
                  )}
                </p>
                {p.componentName && (
                  <p className="text-xs text-muted-foreground">in {p.componentName}</p>
                )}
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Keine Zutaten in der Gruppe „{group}"
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={active === m.id}
                        onClick={() => {
                          rememberGroupChoice(group, m.id);
                          setChoices((c) => ({ ...c, [p.ingredient.id]: m.id }));
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          active === m.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {m.name}
                        {tip === m.id && (
                          <span className="ml-1 text-[10px] font-normal opacity-70">
                            Passt am besten
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Button
          className="w-full"
          disabled={
            !complete &&
            pending.some(
              (p) => mastersInGroup(masters, p.ingredient.product_group ?? "").length > 0,
            )
          }
          onClick={() => onConfirm(selection, effective)}
        >
          Einplanen
        </Button>
      </DialogContent>
    </Dialog>
  );
}
