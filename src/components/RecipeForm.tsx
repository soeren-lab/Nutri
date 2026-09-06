import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Loader2, ImageIcon, Upload, Layers, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAllCategories } from "@/hooks/use-all-categories";
import { CategoryPicker } from "@/components/CategoryPicker";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IngredientInput, type IngredientDraft } from "@/components/IngredientInput";
import {
  ComponentSection,
  type ComponentDraft,
} from "@/components/ComponentSection";
import { DraggableIngredientRow } from "@/components/DraggableIngredientRow";
import { DroppableComponentZone } from "@/components/DroppableComponentZone";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { RecipeLinkPicker } from "@/components/RecipeLinkPicker";
import { StepInput } from "@/components/StepInput";
import { NutritionInput, EMPTY_NUTRITION, type NutritionValue } from "@/components/NutritionInput";
import { NutritionSummary } from "@/components/NutritionSummary";
import { recipeFormSchema, ingredientSchema } from "@/lib/schemas";
import {
  RECIPE_CATEGORIES,
  type IngredientWithMaster,
  type NutritionMode,
  type RecipeWithRelations,
} from "@/types/recipe";
import { supabase } from "@/integrations/supabase/client";
import { makeUid } from "@/lib/uid";
import { uploadRecipeImage, recipesQuery, linkCreatesCycle } from "@/lib/recipes";
import { useSignedImage } from "@/hooks/use-signed-image";
import { estimateNutrition, sumNutrition } from "@/lib/nutrition-db";
import { addNutrition, scaleNutrition } from "@/lib/componentNutrition";
import { useIngredientsMaster } from "@/hooks/use-ingredients-master";
import { computeNutritionFromMaster } from "@/lib/unitConversion";
import { toast } from "sonner";

type NumField = number | "";

function toNutritionValue(i: {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
}): NutritionValue {
  return {
    calories: i.calories ?? "",
    protein_g: i.protein_g ?? "",
    carbs_g: i.carbs_g ?? "",
    fat_g: i.fat_g ?? "",
    fiber_g: i.fiber_g ?? "",
    sugar_g: i.sugar_g ?? "",
  };
}

function emptyIngredient(): IngredientDraft {
  return {
    _uid: makeUid(),
    name: "",
    amount: "",
    unit: "",
    nutrition: { ...EMPTY_NUTRITION },
    ingredient_master_id: null,
    product_group: null,
  };
}

function toIngredientDraft(i: IngredientWithMaster): IngredientDraft {
  const displayName = i.ingredient_master_id && i.master ? i.master.name : i.name;
  return {
    _uid: makeUid(),
    name: displayName,
    amount: i.amount ?? "",
    unit: i.unit ?? "",
    nutrition: i.ingredient_master_id ? { ...EMPTY_NUTRITION } : toNutritionValue(i),
    ingredient_master_id: i.ingredient_master_id ?? null,
    product_group: i.product_group ?? null,
    override_nutrition: false,
  };
}

export function RecipeForm({
  existing,
  onDone,
}: {
  existing?: RecipeWithRelations;
  onDone: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const initialCategories =
    existing?.categories && existing.categories.length > 0
      ? existing.categories
      : existing?.category
        ? [existing.category]
        : [];
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const allCategories = useAllCategories();
  const [tag, setTag] = useState<string>(existing?.tag ?? "");
  const [servings, setServings] = useState<NumField>(existing?.servings ?? "");
  const [prep, setPrep] = useState<NumField>(existing?.prep_time_minutes ?? "");
  const [cook, setCook] = useState<NumField>(existing?.cook_time_minutes ?? "");
  const [isComponentOnly, setIsComponentOnly] = useState<boolean>(
    existing?.is_component_only ?? false,
  );
  // Feste Charge / Form (z.B. Auflaufform) – wird immer als Ganzes gebacken.
  const [isFixedBatchRecipe, setIsFixedBatchRecipe] = useState<boolean>(
    existing?.is_fixed_batch ?? false,
  );
  const [batchServings, setBatchServings] = useState<NumField>(
    existing?.batch_servings != null ? Number(existing.batch_servings) : "",
  );
  const [nutritionMode, setNutritionMode] = useState<NutritionMode>(
    (existing?.nutrition_mode as NutritionMode) ?? "simple",
  );
  const [simpleNutrition, setSimpleNutrition] = useState<NutritionValue>(
    existing
      ? toNutritionValue({
          calories: existing.calories,
          protein_g: existing.protein_g,
          carbs_g: existing.carbs_g,
          fat_g: existing.fat_g,
          fiber_g: existing.fiber_g,
          sugar_g: existing.sugar_g,
        })
      : { ...EMPTY_NUTRITION },
  );
  const [imagePath, setImagePath] = useState<string | null>(existing?.image_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { data: existingImageUrl } = useSignedImage(existing?.image_url ?? null);

  const initialFree = existing
    ? existing.ingredients.filter((i) => !i.component_id).map(toIngredientDraft)
    : [];
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    initialFree.length ? initialFree : existing ? [] : [emptyIngredient()],
  );

  const [components, setComponents] = useState<ComponentDraft[]>(
    existing
      ? existing.components.map((c) => ({
          _uid: makeUid(),
          id: c.id,
          name: c.name,
          servings: c.servings ?? "",
          linked_recipe_id: c.linked_recipe_id,
          component_type: (c.component_type as "fixed" | "choice") ?? "fixed",
          ingredients: c.ingredients
            .filter((i) => !i.variant_id)
            .map(toIngredientDraft),
          variants: [...(c.variants ?? [])]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((v) => ({
              _uid: makeUid(),
              id: v.id,
              label: v.label,
              is_default: v.is_default,
              ingredients: c.ingredients
                .filter((i) => i.variant_id === v.id)
                .map(toIngredientDraft),
            })),
        }))
      : [],
  );

  const [expandedIngredientId, setExpandedIngredientId] = useState<string | null>(() =>
    existing ? null : ingredients[0]?._uid ?? null,
  );
  const [addComponentOpen, setAddComponentOpen] = useState(false);
  const [linkPickerFor, setLinkPickerFor] = useState<"new" | string | null>(null);
  const [savingComponentUid, setSavingComponentUid] = useState<string | null>(null);
  /** Mehrere Komponenten dürfen gleichzeitig offen sein – Standard: alle zu. */
  const [expandedComponentIds, setExpandedComponentIds] = useState<string[]>([]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  /** Zutat per Drag & Drop zwischen freiem Bereich und Komponenten verschieben. */
  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    if (!overId) return;
    const uid = String(event.active.id);
    const from = (event.active.data.current?.fromComponentUid ?? null) as string | null;
    const target = overId === "free" ? null : String(overId).replace(/^comp:/, "");
    if (from === target) return;

    let moved: IngredientDraft | null = null;
    if (from === null) {
      moved = ingredients.find((i) => i._uid === uid) ?? null;
      if (!moved) return;
      setIngredients((s) => s.filter((i) => i._uid !== uid));
    } else {
      const src = components.find((c) => c._uid === from);
      moved = src?.ingredients.find((i) => i._uid === uid) ?? null;
      if (!moved) return;
      setComponents((s) =>
        s.map((c) =>
          c._uid === from
            ? { ...c, ingredients: c.ingredients.filter((i) => i._uid !== uid) }
            : c,
        ),
      );
    }

    const item = moved;
    if (target === null) {
      setIngredients((s) => [...s, item]);
    } else {
      const dest = components.find((c) => c._uid === target);
      if (dest?.linked_recipe_id) {
        toast.error("Verlinkte Komponenten können keine eigenen Zutaten enthalten");
        // Zurück in den Ursprung
        if (from === null) setIngredients((s) => [...s, item]);
        else
          setComponents((s) =>
            s.map((c) =>
              c._uid === from ? { ...c, ingredients: [...c.ingredients, item] } : c,
            ),
          );
        return;
      }
      setComponents((s) =>
        s.map((c) => (c._uid === target ? { ...c, ingredients: [...c.ingredients, item] } : c)),
      );
      setExpandedComponentIds((s) => (s.includes(target) ? s : [...s, target]));
    }
  }

  /**
   * Zutaten, die für eine Komponente zählen: bei 'choice' nur die
   * Standard-Variante (Anzeige/Berechnung im Formular).
   */
  function effectiveDraftIngredients(c: ComponentDraft): IngredientDraft[] {
    if (c.component_type !== "choice") return c.ingredients;
    const v = c.variants.find((x) => x.is_default) ?? c.variants[0];
    return v?.ingredients ?? [];
  }

  /** Nährwerte pro Portion einer Komponente – für die kompakte Header-Anzeige. */
  function componentPerServing(c: ComponentDraft) {
    const servings = c.servings === "" || Number(c.servings) <= 0 ? 1 : Number(c.servings);
    if (c.linked_recipe_id) {
      const r = allRecipes.find((x) => x.id === c.linked_recipe_id);
      if (!r) return undefined;
      const base = r.servings && r.servings > 0 ? r.servings : 1;
      return scaleNutrition(
        {
          calories: r.calories,
          protein_g: r.protein_g,
          carbs_g: r.carbs_g,
          fat_g: r.fat_g,
          fiber_g: r.fiber_g,
          sugar_g: r.sugar_g,
        },
        1 / base,
      );
    }
    const list = effectiveDraftIngredients(c);
    if (list.length === 0) return undefined;
    return scaleNutrition(sumNutrition(list.map(nutritionForDraft)), 1 / servings);
  }

  const [steps, setSteps] = useState<string[]>(
    existing?.steps.length ? existing.steps.map((s) => s.instruction) : [""],
  );

  const masterList = useIngredientsMaster();
  const { data: allRecipes = [] } = useQuery(recipesQuery());
  const findMaster = (id: string | null) =>
    id ? masterList.find((m) => m.id === id) ?? null : null;

  const nutritionForDraft = (i: IngredientDraft) => {
    // Produktgruppen zählen erst, wenn beim Kochen eine Sorte gewählt wird.
    if (i.product_group && !i.ingredient_master_id) {
      return { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, sugar_g: null };
    }
    const master = findMaster(i.ingredient_master_id);
    const manualValues = {
      calories: i.nutrition.calories === "" ? null : Number(i.nutrition.calories),
      protein_g: i.nutrition.protein_g === "" ? null : Number(i.nutrition.protein_g),
      carbs_g: i.nutrition.carbs_g === "" ? null : Number(i.nutrition.carbs_g),
      fat_g: i.nutrition.fat_g === "" ? null : Number(i.nutrition.fat_g),
      fiber_g: i.nutrition.fiber_g === "" ? null : Number(i.nutrition.fiber_g),
      sugar_g: i.nutrition.sugar_g === "" ? null : Number(i.nutrition.sugar_g),
    };
    if (master && !i.override_nutrition) {
      const c = computeNutritionFromMaster(
        master,
        i.amount === "" ? null : Number(i.amount),
        i.unit || null,
      );
      if (!c.convertible) return manualValues;
      return {
        calories: c.calories,
        protein_g: c.protein_g,
        carbs_g: c.carbs_g,
        fat_g: c.fat_g,
        fiber_g: c.fiber_g,
        sugar_g: c.sugar_g,
      };
    }
    return manualValues;
  };

  /**
   * Gesamtsumme: freie Zutaten + Zutaten aller Inline-Komponenten +
   * verlinkte Komponenten (Nährwerte pro Portion × Portionen der Komponente).
   */
  const advancedTotals = useMemo(() => {
    const flat = [...ingredients, ...components.flatMap(effectiveDraftIngredients)];
    const base = sumNutrition(flat.map(nutritionForDraft));
    const linkedParts = components
      .filter((c) => c.linked_recipe_id)
      .map((c) => {
        const r = allRecipes.find((x) => x.id === c.linked_recipe_id);
        if (!r)
          return { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, sugar_g: null };
        const baseServings = r.servings && r.servings > 0 ? r.servings : 1;
        const want = c.servings === "" || Number(c.servings) <= 0 ? 1 : Number(c.servings);
        return scaleNutrition(
          {
            calories: r.calories,
            protein_g: r.protein_g,
            carbs_g: r.carbs_g,
            fat_g: r.fat_g,
            fiber_g: r.fiber_g,
            sugar_g: r.sugar_g,
          },
          want / baseServings,
        );
      });
    return addNutrition(base, ...linkedParts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients, components, masterList, allRecipes]);

  /** Fehlende Nährwerte automatisch aus Master/Nährwert-DB ergänzen. */
  function enrichList(list: IngredientDraft[]): { list: IngredientDraft[]; filled: number } {
    let filled = 0;
    const out = list.map((i) => {
      if (i.product_group && !i.ingredient_master_id) return i;
      const master = findMaster(i.ingredient_master_id);
      if (master && !i.override_nutrition) {
        const c = computeNutritionFromMaster(
          master,
          i.amount === "" ? null : Number(i.amount),
          i.unit || null,
        );
        if (!c.convertible) return i;
        return {
          ...i,
          nutrition: {
            calories: c.calories ?? "",
            protein_g: c.protein_g ?? "",
            carbs_g: c.carbs_g ?? "",
            fat_g: c.fat_g ?? "",
            fiber_g: c.fiber_g ?? "",
            sugar_g: c.sugar_g ?? "",
          } as NutritionValue,
        };
      }
      const n = i.nutrition;
      const missing =
        n.calories === "" ||
        n.protein_g === "" ||
        n.carbs_g === "" ||
        n.fat_g === "" ||
        n.fiber_g === "" ||
        n.sugar_g === "";
      if (!missing) return i;
      const est = estimateNutrition(
        i.name,
        i.amount === "" ? null : Number(i.amount),
        i.unit || null,
      );
      if (!est) return i;
      const merged: NutritionValue = {
        calories: n.calories === "" && est.calories != null ? est.calories : n.calories,
        protein_g: n.protein_g === "" && est.protein_g != null ? est.protein_g : n.protein_g,
        carbs_g: n.carbs_g === "" && est.carbs_g != null ? est.carbs_g : n.carbs_g,
        fat_g: n.fat_g === "" && est.fat_g != null ? est.fat_g : n.fat_g,
        fiber_g: n.fiber_g === "" && est.fiber_g != null ? est.fiber_g : n.fiber_g,
        sugar_g: n.sugar_g === "" && est.sugar_g != null ? est.sugar_g : n.sugar_g,
      };
      if (
        merged.calories !== n.calories ||
        merged.protein_g !== n.protein_g ||
        merged.carbs_g !== n.carbs_g ||
        merged.fat_g !== n.fat_g ||
        merged.fiber_g !== n.fiber_g ||
        merged.sugar_g !== n.sugar_g
      ) {
        filled += 1;
      }
      return { ...i, nutrition: merged };
    });
    return { list: out, filled };
  }

  function toParseInput(i: IngredientDraft) {
    // Produktgruppe bleibt erhalten, AUCH wenn bereits eine Sorte (Master)
    // gewählt ist – sonst ist die Zutat nach dem Speichern nicht mehr flexibel.
    const group = i.product_group?.trim() ? i.product_group.trim() : null;
    const groupOpen = !!group && !i.ingredient_master_id;
    return {
      name: groupOpen ? group! : i.name,
      amount: i.amount === "" ? undefined : Number(i.amount),
      unit: i.unit || undefined,
      ingredient_master_id: i.ingredient_master_id,
      product_group: group,
      calories: i.nutrition.calories === "" ? undefined : Number(i.nutrition.calories),
      protein_g: i.nutrition.protein_g === "" ? undefined : Number(i.nutrition.protein_g),
      carbs_g: i.nutrition.carbs_g === "" ? undefined : Number(i.nutrition.carbs_g),
      fat_g: i.nutrition.fat_g === "" ? undefined : Number(i.nutrition.fat_g),
      fiber_g: i.nutrition.fiber_g === "" ? undefined : Number(i.nutrition.fiber_g),
      sugar_g: i.nutrition.sugar_g === "" ? undefined : Number(i.nutrition.sugar_g),
    };
  }


  const ingredientListSchema = z.array(ingredientSchema);

  function parseIngredients(list: IngredientDraft[]) {
    const res = ingredientListSchema.safeParse(list.map(toParseInput));
    if (!res.success) {
      throw new Error(res.error.issues[0]?.message ?? "Ungültige Zutat");
    }
    return res.data;
  }

  function ingredientRow(
    i: ReturnType<typeof parseIngredients>[number],
    recipeId: string,
    idx: number,
    componentId: string | null,
    variantId: string | null = null,
  ) {
    const isGroup = !!i.product_group;
    const linked = !!i.ingredient_master_id || isGroup;
    return {
      id: crypto.randomUUID(),
      recipe_id: recipeId,
      component_id: componentId,
      variant_id: variantId,
      name: i.name,
      amount: i.amount,
      unit: i.unit,
      sort_order: idx,
      ingredient_master_id: i.ingredient_master_id ?? null,
      product_group: i.product_group ?? null,
      // Bei verknüpfter Stammzutat bzw. Produktgruppe werden Nährwerte NICHT
      // persistiert – sie werden live berechnet bzw. bei Auswahl der Sorte.
      calories: linked ? null : i.calories,
      protein_g: linked ? null : i.protein_g,
      carbs_g: linked ? null : i.carbs_g,
      fat_g: linked ? null : i.fat_g,
      fiber_g: linked ? null : i.fiber_g,
      sugar_g: linked ? null : i.sugar_g,
    };
  }

  /**
   * IDs für Rezept/Komponenten/Varianten werden VOR dem eigentlichen Request
   * erzeugt (client-seitig, nicht von der DB) – nur so kann der Speichervorgang
   * offline sofort optimistisch im Cache angezeigt und später unverändert
   * synchronisiert werden (siehe `onMutate` unten). Bestehende IDs werden
   * wiederverwendet, damit sich die Identität einer Komponente/Variante beim
   * Bearbeiten nicht ändert.
   */
  function buildMutationIds() {
    return {
      recipeId: existing?.id ?? crypto.randomUUID(),
      componentIds: components.map((c) => c.id ?? crypto.randomUUID()),
      variantIdByUid: Object.fromEntries(
        components.flatMap((c) => c.variants.map((v) => [v._uid, v.id ?? crypto.randomUUID()] as const)),
      ) as Record<string, string>,
    };
  }
  type MutationIds = ReturnType<typeof buildMutationIds>;

  /**
   * Baut aus dem aktuellen Formular-Stand ein Rezept-Objekt im selben Format
   * wie die Server-Antwort, damit es sofort (auch offline) im Query-Cache
   * sichtbar ist. Wird nach erfolgreichem Sync durch die echten Daten ersetzt.
   * Vereinfachung: automatisch ergänzte Nährwerte (`enrichList`) erscheinen
   * erst nach dem echten Sync, nicht schon in dieser Vorschau.
   */
  function buildOptimisticRecipe(ids: MutationIds): RecipeWithRelations {
    const now = new Date().toISOString();
    const toOptimisticIngredient = (
      i: IngredientDraft,
      componentId: string | null,
      variantId: string | null,
      idx: number,
    ) => ({
      id: crypto.randomUUID(),
      recipe_id: ids.recipeId,
      component_id: componentId,
      variant_id: variantId,
      name: i.name,
      amount: i.amount === "" ? null : Number(i.amount),
      unit: i.unit || null,
      sort_order: idx,
      ingredient_master_id: i.ingredient_master_id ?? null,
      product_group: i.product_group ?? null,
      master: findMaster(i.ingredient_master_id ?? null),
      ...nutritionForDraft(i),
    });

    const optimisticComponents = components.map((c, cIdx) => ({
      id: ids.componentIds[cIdx]!,
      recipe_id: ids.recipeId,
      name: c.name.trim() || `Komponente ${cIdx + 1}`,
      servings: c.servings === "" || Number(c.servings) <= 0 ? null : Number(c.servings),
      sort_order: cIdx,
      linked_recipe_id: c.linked_recipe_id,
      component_type: c.component_type,
      created_at: now,
      updated_at: now,
      ingredients: c.ingredients.map((i, idx) =>
        toOptimisticIngredient(i, ids.componentIds[cIdx]!, null, idx),
      ),
      variants: c.variants.map((v, idx) => ({
        id: ids.variantIdByUid[v._uid]!,
        component_id: ids.componentIds[cIdx]!,
        label: v.label.trim() || `Variante ${idx + 1}`,
        sort_order: idx,
        is_default: v.is_default,
        created_at: now,
      })),
      linked: c.linked_recipe_id
        ? (allRecipes.find((r) => r.id === c.linked_recipe_id) as RecipeWithRelations | undefined) ?? null
        : null,
    }));

    const nutritionTotals =
      nutritionMode === "advanced"
        ? advancedTotals
        : {
            calories: simpleNutrition.calories === "" ? null : Number(simpleNutrition.calories),
            protein_g: simpleNutrition.protein_g === "" ? null : Number(simpleNutrition.protein_g),
            carbs_g: simpleNutrition.carbs_g === "" ? null : Number(simpleNutrition.carbs_g),
            fat_g: simpleNutrition.fat_g === "" ? null : Number(simpleNutrition.fat_g),
            fiber_g: simpleNutrition.fiber_g === "" ? null : Number(simpleNutrition.fiber_g),
            sugar_g: simpleNutrition.sugar_g === "" ? null : Number(simpleNutrition.sugar_g),
          };

    return {
      id: ids.recipeId,
      user_id: existing?.user_id ?? "",
      title,
      description: description || null,
      category: categories[0] || null,
      categories,
      tag: tag || null,
      servings: servings === "" ? null : Number(servings),
      prep_time_minutes: prep === "" ? null : Number(prep),
      cook_time_minutes: cook === "" ? null : Number(cook),
      nutrition_mode: nutritionMode,
      is_component_only: isComponentOnly,
      is_fixed_batch: isFixedBatchRecipe,
      batch_servings: isFixedBatchRecipe
        ? batchServings === ""
          ? servings === ""
            ? null
            : Number(servings)
          : Number(batchServings)
        : null,
      ...nutritionTotals,
      image_url: imagePath,
      is_published: existing?.is_published ?? false,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      ingredients: ingredients.map((i, idx) => toOptimisticIngredient(i, null, null, idx)),
      components: optimisticComponents,
      steps: steps.map((instruction, idx) => ({
        id: crypto.randomUUID(),
        recipe_id: ids.recipeId,
        step_number: idx + 1,
        instruction,
      })),
    } as unknown as RecipeWithRelations;
  }

  const mutation = useMutation({
    onMutate: (ids: MutationIds) => {
      const optimistic = buildOptimisticRecipe(ids);
      qc.setQueryData(["recipes", ids.recipeId], optimistic);
      qc.setQueryData(["recipes"], (old: RecipeWithRelations[] | undefined) => {
        const list = old ?? [];
        const idx = list.findIndex((r) => r.id === ids.recipeId);
        if (idx === -1) return [optimistic, ...list];
        return list.map((r, i) => (i === idx ? optimistic : r));
      });
    },
    mutationFn: async (ids: MutationIds) => {
      let freeDrafts = ingredients;
      let componentDrafts = components;
      let filledCount = 0;

      if (nutritionMode === "advanced") {
        const free = enrichList(ingredients);
        freeDrafts = free.list;
        filledCount += free.filled;
        componentDrafts = components.map((c) => {
          const r = enrichList(c.ingredients);
          filledCount += r.filled;
          const variants = c.variants.map((v) => {
            const rv = enrichList(v.ingredients);
            filledCount += rv.filled;
            return { ...v, ingredients: rv.list };
          });
          return { ...c, ingredients: r.list, variants };
        });
        setIngredients(freeDrafts);
        setComponents(componentDrafts);
      }

      const inlineComponents = componentDrafts.filter((c) => !c.linked_recipe_id);
      for (const c of inlineComponents) {
        if (!c.name.trim()) throw new Error("Jede Komponente braucht einen Namen");
      }
      const totalIngredientCount =
        freeDrafts.length +
        componentDrafts.reduce(
          (n, c) =>
            n +
            c.ingredients.length +
            c.variants.reduce((m, v) => m + v.ingredients.length, 0),
          0,
        );
      const hasLinked = componentDrafts.some((c) => c.linked_recipe_id);
      if (totalIngredientCount === 0 && !hasLinked) {
        throw new Error("Mindestens eine Zutat");
      }

      const parsed = recipeFormSchema.safeParse({
        title,
        description,
        category: categories[0] || undefined,
        categories,
        tag: tag || undefined,
        servings: servings === "" ? undefined : Number(servings),
        prep_time_minutes: prep === "" ? undefined : Number(prep),
        cook_time_minutes: cook === "" ? undefined : Number(cook),
        calories: simpleNutrition.calories === "" ? undefined : Number(simpleNutrition.calories),
        protein_g:
          simpleNutrition.protein_g === "" ? undefined : Number(simpleNutrition.protein_g),
        carbs_g: simpleNutrition.carbs_g === "" ? undefined : Number(simpleNutrition.carbs_g),
        fat_g: simpleNutrition.fat_g === "" ? undefined : Number(simpleNutrition.fat_g),
        fiber_g: simpleNutrition.fiber_g === "" ? undefined : Number(simpleNutrition.fiber_g),
        sugar_g: simpleNutrition.sugar_g === "" ? undefined : Number(simpleNutrition.sugar_g),
        ingredients: freeDrafts.map(toParseInput),
        steps: steps.map((instruction) => ({ instruction })),
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
      }
      const v = parsed.data;
      const parsedComponents = componentDrafts.map((c) => ({
        draft: c,
        ingredients: parseIngredients(c.ingredients),
        variants: c.variants.map((v) => ({
          draft: v,
          ingredients: parseIngredients(v.ingredients),
        })),
      }));
      for (const c of parsedComponents) {
        if (c.draft.component_type !== "choice" || c.draft.linked_recipe_id) continue;
        if (c.variants.length === 0) {
          throw new Error(`„${c.draft.name}" braucht mindestens eine Variante`);
        }
        for (const v of c.variants) {
          if (!v.draft.label.trim())
            throw new Error("Jede Variante braucht einen Namen");
        }
      }

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Nicht angemeldet");

      let finalImagePath = imagePath;
      if (imageFile) {
        finalImagePath = await uploadRecipeImage(uid, imageFile);
      }

      const totals = nutritionMode === "advanced" ? advancedTotals : null;
      const payload = {
        user_id: uid,
        title: v.title,
        description: v.description || null,
        category: v.category || null,
        categories: v.categories,
        tag: v.tag,
        servings: v.servings,
        prep_time_minutes: v.prep_time_minutes,
        cook_time_minutes: v.cook_time_minutes,
        nutrition_mode: nutritionMode,
        is_component_only: isComponentOnly,
        is_fixed_batch: isFixedBatchRecipe,
        batch_servings: isFixedBatchRecipe
          ? batchServings === ""
            ? v.servings
            : Number(batchServings)
          : null,
        calories: totals ? totals.calories : v.calories,
        protein_g: totals ? totals.protein_g : v.protein_g,
        carbs_g: totals ? totals.carbs_g : v.carbs_g,
        fat_g: totals ? totals.fat_g : v.fat_g,
        fiber_g: totals ? totals.fiber_g : v.fiber_g,
        sugar_g: totals ? totals.sugar_g : v.sugar_g,
        image_url: finalImagePath,
      };

      const recipeId = ids.recipeId;
      if (existing) {
        const { error } = await supabase.from("recipes").update(payload).eq("id", existing.id);
        if (error) throw error;
        await supabase.from("ingredients").delete().eq("recipe_id", recipeId);
        await supabase.from("steps").delete().eq("recipe_id", recipeId);
        await supabase.from("recipe_components").delete().eq("recipe_id", recipeId);
      } else {
        const { error } = await supabase.from("recipes").insert({ id: recipeId, ...payload });
        if (error) throw error;
      }

      // Komponenten neu anlegen – IDs wurden bereits vorab erzeugt (offline-fähig).
      const componentIds = ids.componentIds;
      if (parsedComponents.length > 0) {
        const { error: compErr } = await supabase.from("recipe_components").insert(
          parsedComponents.map((c, idx) => ({
            id: componentIds[idx],
            recipe_id: recipeId,
            name: c.draft.name.trim() || `Komponente ${idx + 1}`,
            servings:
              c.draft.servings === "" || Number(c.draft.servings) <= 0
                ? null
                : Number(c.draft.servings),
            sort_order: idx,
            linked_recipe_id: c.draft.linked_recipe_id,
            component_type: c.draft.component_type,
          })),
        );
        if (compErr) throw compErr;
      }

      // Varianten der Auswahl-Komponenten anlegen – IDs ebenfalls vorab erzeugt.
      const variantIds = ids.variantIdByUid;
      const variantRows = parsedComponents.flatMap((c, cIdx) =>
        c.draft.component_type === "choice" && !c.draft.linked_recipe_id
          ? c.variants.map((v, idx) => ({
              id: variantIds[v.draft._uid],
              component_id: componentIds[cIdx] ?? null,
              label: v.draft.label.trim() || `Variante ${idx + 1}`,
              sort_order: idx,
              is_default: v.draft.is_default,
            }))
          : [],
      );
      if (variantRows.length > 0) {
        const { error: varErr } = await supabase
          .from("component_variants")
          .insert(variantRows.map((row) => ({ ...row, component_id: row.component_id as string })));
        if (varErr) throw varErr;
      }

      const ingRows = [
        ...v.ingredients.map((i, idx) => ingredientRow(i, recipeId, idx, null)),
        ...parsedComponents.flatMap((c, cIdx) => [
          ...c.ingredients.map((i, idx) =>
            ingredientRow(i, recipeId, idx, componentIds[cIdx] ?? null),
          ),
          ...(c.draft.component_type === "choice" && !c.draft.linked_recipe_id
            ? c.variants.flatMap((vr) =>
                vr.ingredients.map((i, idx) =>
                  ingredientRow(
                    i,
                    recipeId,
                    idx,
                    componentIds[cIdx] ?? null,
                    variantIds[vr.draft._uid] ?? null,
                  ),
                ),
              )
            : []),
        ]),
      ];

      const stepRows = v.steps.map((s, idx) => ({
        recipe_id: recipeId,
        step_number: idx + 1,
        instruction: s.instruction,
      }));
      const [ingRes, stepRes] = await Promise.all([
        ingRows.length > 0
          ? supabase.from("ingredients").insert(ingRows)
          : Promise.resolve({ error: null }),
        supabase.from("steps").insert(stepRows),
      ]);
      if (ingRes.error) throw ingRes.error;
      if (stepRes.error) throw stepRes.error;

      return { id: recipeId, filledCount };
    },
    onSuccess: ({ id, filledCount }) => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["recipes", id] });
      if (filledCount > 0) {
        toast.success(
          `Rezept gespeichert · ${filledCount} Zutat${filledCount === 1 ? "" : "en"} automatisch ergänzt`,
        );
      } else {
        toast.success(existing ? "Rezept aktualisiert" : "Rezept gespeichert");
      }
      onDone(id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen"),
  });

  function handleFile(f: File | null) {
    setImageFile(f);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(f ? URL.createObjectURL(f) : null);
    if (f) setImagePath(null);
  }

  function addInlineComponent() {
    const fresh = emptyIngredient();
    const uid = makeUid();
    setComponents((s) => [
      ...s,
      {
        _uid: uid,
        id: null,
        name: "",
        servings: "",
        linked_recipe_id: null,
        component_type: "fixed",
        ingredients: [fresh],
        variants: [],
      },
    ]);
    setExpandedComponentIds((s) => [...s, uid]);
    setExpandedIngredientId(fresh._uid);
    setAddComponentOpen(false);
  }

  async function handleLinkRecipe(recipe: { id: string; title: string; servings: number | null }) {
    const target = linkPickerFor;
    setLinkPickerFor(null);
    try {
      if (await linkCreatesCycle(existing?.id ?? null, recipe.id)) {
        toast.error("Diese Verknüpfung würde einen Zirkelbezug erzeugen");
        return;
      }
    } catch {
      toast.error("Verknüpfung konnte nicht geprüft werden");
      return;
    }
    if (target && target !== "new") {
      setComponents((s) =>
        s.map((c) =>
          c._uid === target
            ? {
                ...c,
                linked_recipe_id: recipe.id,
                name: c.name.trim() || recipe.title,
                servings: c.servings === "" ? (recipe.servings ?? "") : c.servings,
                ingredients: [],
              }
            : c,
        ),
      );
    } else {
      const uid = makeUid();
      setComponents((s) => [
        ...s,
        {
          _uid: uid,
          id: null,
          name: recipe.title,
          servings: recipe.servings ?? "",
          linked_recipe_id: recipe.id,
          component_type: "fixed",
          ingredients: [],
          variants: [],
        },
      ]);
      setExpandedComponentIds((s) => [...s, uid]);
    }
    setAddComponentOpen(false);
  }

  /** Inline-Komponente als eigenes Rezept speichern und danach verlinken. */
  async function saveComponentAsRecipe(c: ComponentDraft) {
    if (!c.name.trim()) {
      toast.error("Bitte zuerst einen Namen für die Komponente eingeben");
      return;
    }
    setSavingComponentUid(c._uid);
    try {
      const source = effectiveDraftIngredients(c);
      const enriched = nutritionMode === "advanced" ? enrichList(source).list : source;
      const parsedIng = parseIngredients(enriched);
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Nicht angemeldet");
      const compServings =
        c.servings === "" || Number(c.servings) <= 0 ? 1 : Math.round(Number(c.servings));
      const compTotals = sumNutrition(enriched.map(nutritionForDraft));
      const { data: newRecipe, error } = await supabase
        .from("recipes")
        .insert({
          user_id: uid,
          title: c.name.trim(),
          servings: compServings,
          categories: [],
          nutrition_mode: "advanced",
          is_component_only: true,
          calories: compTotals.calories,
          protein_g: compTotals.protein_g,
          carbs_g: compTotals.carbs_g,
          fat_g: compTotals.fat_g,
          fiber_g: compTotals.fiber_g,
          sugar_g: compTotals.sugar_g,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (parsedIng.length > 0) {
        const { error: ingErr } = await supabase
          .from("ingredients")
          .insert(parsedIng.map((i, idx) => ingredientRow(i, newRecipe.id, idx, null)));
        if (ingErr) throw ingErr;
      }
      const { error: stepErr } = await supabase.from("steps").insert({
        recipe_id: newRecipe.id,
        step_number: 1,
        instruction: `Zutaten für ${c.name.trim()} zubereiten.`,
      });
      if (stepErr) throw stepErr;

      setComponents((s) =>
        s.map((x) =>
          x._uid === c._uid
            ? { ...x, linked_recipe_id: newRecipe.id, ingredients: [], variants: [] }
            : x,
        ),
      );
      await qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success(`„${c.name.trim()}" als eigenes Rezept gespeichert und verlinkt`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSavingComponentUid(null);
    }
  }

  const previewSrc = imagePreview ?? existingImageUrl ?? null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(buildMutationIds());
      }}
      className="space-y-6"
    >
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-1.5">
          <Label htmlFor="title">Titel *</Label>
          <Input
            id="title"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc">Beschreibung</Label>
          <Textarea
            id="desc"
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Bild</Label>
          <div className="flex items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {previewSrc ? (
                <img src={previewSrc} alt="Vorschau" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" />
              Bild wählen
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="servings">Portionen</Label>
            <Input
              id="servings"
              type="number"
              min={1}
              value={servings}
              onChange={(e) => setServings(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prep">Vorb. (min)</Label>
            <Input
              id="prep"
              type="number"
              min={0}
              value={prep}
              onChange={(e) => setPrep(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cook">Kochen (min)</Label>
            <Input
              id="cook"
              type="number"
              min={0}
              value={cook}
              onChange={(e) => setCook(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Kategorien</Label>
          <CategoryPicker value={categories} onChange={setCategories} options={allCategories} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="recipe-tag">Tag</Label>
          <Input
            id="recipe-tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            maxLength={40}
            placeholder="test"
          />
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
          <span>
            <span className="block text-sm font-medium">Vor allem als Teilrezept gedacht</span>
            <span className="block text-xs text-muted-foreground">
              Nur ein Hinweis – ändert nichts an Sichtbarkeit oder Zugriff.
            </span>
          </span>
          <Switch
            checked={isComponentOnly}
            onCheckedChange={setIsComponentOnly}
            aria-label="Als Teilrezept kennzeichnen"
          />
        </label>

        <div className="space-y-3 rounded-lg bg-muted/40 p-3">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">Feste Charge / Form</span>
              <span className="block text-xs text-muted-foreground">
                Z.B. Auflaufform – wird immer als Ganzes gebacken, nicht beliebig verkleinert.
              </span>
            </span>
            <Switch
              checked={isFixedBatchRecipe}
              onCheckedChange={setIsFixedBatchRecipe}
              aria-label="Als feste Charge kennzeichnen"
            />
          </label>
          {isFixedBatchRecipe && (
            <div className="space-y-1.5">
              <Label htmlFor="batch-servings">Portionen pro Form</Label>
              <Input
                id="batch-servings"
                type="number"
                min={1}
                value={batchServings}
                onChange={(e) =>
                  setBatchServings(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder={servings === "" ? "z.B. 4" : String(servings)}
              />
            </div>
          )}
        </div>
      </section>


      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Nährwerte</h2>
            <p className="text-xs text-muted-foreground">
              {nutritionMode === "simple"
                ? "Gesamt-Werte manuell pflegen"
                : "Pro Zutat pflegen – Summe wird berechnet"}
            </p>
          </div>
          <Tabs
            value={nutritionMode}
            onValueChange={(v) => setNutritionMode(v as NutritionMode)}
          >
            <TabsList>
              <TabsTrigger value="simple">Einfach</TabsTrigger>
              <TabsTrigger value="advanced">Erweitert</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {nutritionMode === "simple" ? (
          <NutritionInput
            value={simpleNutrition}
            onChange={setSimpleNutrition}
            idPrefix="simple"
          />
        ) : (
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Berechnete Gesamtsumme
            </div>
            <NutritionSummary totals={advancedTotals} />
            <p className="mt-3 text-xs text-muted-foreground">
              Leere Felder werden beim Speichern – wenn möglich – aus einer internen
              Nährwert-Datenbank vorgeschlagen.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Zutaten</h2>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddComponentOpen(true)}
            >
              <Layers className="mr-1 h-4 w-4" /> Komponente hinzufügen
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const fresh = emptyIngredient();
                setIngredients((s) => [...s, fresh]);
                setExpandedIngredientId(fresh._uid);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Zutat
            </Button>
          </div>
        </div>

        <DndContext sensors={dndSensors} onDragEnd={handleDragEnd}>
          {components.length > 0 && (
            <div className="space-y-3">
              {components.map((c, ci) => (
                <ComponentSection
                  key={c._uid}
                  index={ci}
                  value={c}
                  expanded={expandedComponentIds.includes(c._uid)}
                  onToggleExpand={() =>
                    setExpandedComponentIds((s) =>
                      s.includes(c._uid) ? s.filter((x) => x !== c._uid) : [...s, c._uid],
                    )
                  }
                  perServing={componentPerServing(c)}
                  showNutrition={nutritionMode === "advanced"}
                  expandedIngredientId={expandedIngredientId}
                  onToggleIngredient={(uid) =>
                    setExpandedIngredientId((cur) => (cur === uid ? null : uid))
                  }
                  onChange={(v) =>
                    setComponents((s) => s.map((x) => (x._uid === c._uid ? v : x)))
                  }
                  onRemove={() => setComponents((s) => s.filter((x) => x._uid !== c._uid))}
                  onAddIngredient={() => {
                    const fresh = emptyIngredient();
                    setComponents((s) =>
                      s.map((x) =>
                        x._uid === c._uid ? { ...x, ingredients: [...x.ingredients, fresh] } : x,
                      ),
                    );
                    setExpandedIngredientId(fresh._uid);
                  }}
                  onSaveAsRecipe={() => void saveComponentAsRecipe(c)}
                  savingAsRecipe={savingComponentUid === c._uid}
                  newIngredient={emptyIngredient}
                />
              ))}
            </div>
          )}

          <DroppableComponentZone
            id="free"
            className="mt-3 rounded-xl border border-dashed border-border p-2"
          >
            {components.length > 0 && (
              <div className="px-1 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ohne Komponente
              </div>
            )}
            <div className="space-y-2">
              {ingredients.length === 0 && (
                <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                  Keine freien Zutaten – hierher ziehen, um sie aus einer Komponente zu lösen
                </p>
              )}
              {ingredients.map((ing, i) => (
                <DraggableIngredientRow key={ing._uid} uid={ing._uid} fromComponentUid={null}>
                  <IngredientInput
                    index={i}
                    value={ing}
                    showNutrition={nutritionMode === "advanced"}
                    expanded={expandedIngredientId === ing._uid}
                    onToggleExpand={() =>
                      setExpandedIngredientId((cur) => (cur === ing._uid ? null : ing._uid))
                    }
                    onChange={(v) =>
                      setIngredients((s) => s.map((x, idx) => (idx === i ? v : x)))
                    }
                    onRemove={() => {
                      setIngredients((s) => s.filter((_, idx) => idx !== i));
                      setExpandedIngredientId((cur) => (cur === ing._uid ? null : cur));
                    }}
                  />
                </DraggableIngredientRow>
              ))}
            </div>
          </DroppableComponentZone>
        </DndContext>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Zubereitung</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSteps((s) => [...s, ""])}
          >
            <Plus className="mr-1 h-4 w-4" /> Schritt
          </Button>
        </div>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <StepInput
              key={i}
              index={i}
              value={s}
              onChange={(v) => setSteps((arr) => arr.map((x, idx) => (idx === i ? v : x)))}
              onRemove={() =>
                setSteps((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr))
              }
            />
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {existing ? "Änderungen speichern" : "Rezept speichern"}
        </Button>
      </div>

      <Dialog open={addComponentOpen} onOpenChange={setAddComponentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Komponente hinzufügen</DialogTitle>
            <DialogDescription>
              Eine eigene Zutatengruppe anlegen oder ein bestehendes Rezept verlinken.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button type="button" variant="outline" className="justify-start" onClick={addInlineComponent}>
              <Layers className="mr-2 h-4 w-4" /> Neue Zutatengruppe
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => {
                setAddComponentOpen(false);
                setLinkPickerFor("new");
              }}
            >
              <Link2 className="mr-2 h-4 w-4" /> Bestehendes Rezept verlinken
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RecipeLinkPicker
        open={linkPickerFor !== null}
        onOpenChange={(o) => !o && setLinkPickerFor(null)}
        excludeRecipeId={existing?.id ?? null}
        onSelect={(r) => handleLinkRecipe(r)}
      />
    </form>
  );
}
