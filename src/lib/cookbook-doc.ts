import { db } from "@/integrations/db/client";
import { nutritionPerServing } from "@/lib/componentNutrition";
import type {
  CookbookDoc,
  CookbookIngredient,
  CookbookRecipe,
  CookbookSection,
} from "@/lib/cookbook-html";

/* eslint-disable @typescript-eslint/no-explicit-any */

const RECIPE_SELECT =
  "*, ingredients(*, master:ingredients_master(*)), steps(*), components:recipe_components!recipe_components_recipe_id_fkey(*)";

/** Speicherpfad als storage://-Verweis (der Server bettet das Bild verkleinert ein). */
function imageRef(bucket: string, path: string | null | undefined): string | null {
  if (!path || /^https?:/i.test(path)) return null;
  return /^[A-Za-z0-9._\/-]+$/.test(path) ? `storage://${bucket}/${path}` : null;
}

function formatAmount(amount: number | null | undefined, unit: string | null | undefined): string {
  if (amount == null || amount === 0) return "";
  const n = Number.isInteger(amount)
    ? String(amount)
    : String(Math.round(amount * 10) / 10).replace(".", ",");
  return `${n} ${unit ?? ""}`.trim();
}

function withComponents(r: any, linkedById: Map<string, any>) {
  return {
    ...r,
    ingredients: [...(r.ingredients ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order),
    steps: [...(r.steps ?? [])].sort((a: any, b: any) => a.step_number - b.step_number),
    components: [...(r.components ?? [])]
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((c: any) => ({
        ...c,
        ingredients: (r.ingredients ?? []).filter((i: any) => i.component_id === c.id),
        linked: c.linked_recipe_id ? (linkedById.get(c.linked_recipe_id) ?? null) : null,
      })),
  };
}

function toIngredient(i: any): CookbookIngredient {
  return { amount: formatAmount(i.amount, i.unit), name: String(i.master?.name ?? i.name ?? "") };
}

function toSections(r: any): CookbookSection[] {
  const sections: CookbookSection[] = [];
  const free = (r.ingredients ?? []).filter((i: any) => !i.component_id);
  if (free.length) sections.push({ title: null, ingredients: free.map(toIngredient) });
  for (const c of r.components ?? []) {
    if (c.linked) {
      const portions = c.servings
        ? `${c.servings} ${c.servings === 1 ? "Portion" : "Portionen"}`
        : "";
      sections.push({
        title: c.name || null,
        ingredients: [{ amount: portions, name: String(c.linked.title ?? "") }],
      });
    } else if (c.ingredients.length) {
      sections.push({ title: c.name || null, ingredients: c.ingredients.map(toIngredient) });
    }
  }
  return sections;
}

function toRecipe(r: any): CookbookRecipe {
  const total = (r.prep_time_minutes ?? 0) + (r.cook_time_minutes ?? 0);
  const per = nutritionPerServing(r);
  return {
    title: String(r.title ?? ""),
    description: r.description ?? null,
    image: imageRef("recipe-images", r.image_url),
    categories: (r.categories ?? []).filter(Boolean),
    totalMinutes: total > 0 ? total : null,
    servings: r.servings ?? null,
    sections: toSections(r),
    steps: (r.steps ?? []).map((s: any) => String(s.instruction ?? "")).filter(Boolean),
    nutrition:
      per.calories != null
        ? {
            kcal: Math.round(per.calories),
            fat_g: per.fat_g ?? 0,
            carbs_g: per.carbs_g ?? 0,
            fiber_g: per.fiber_g ?? 0,
            protein_g: per.protein_g ?? 0,
          }
        : null,
  };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "kochbuch"
  );
}

/** Lädt ein Kochbuch samt Rezepten und macht daraus die Daten für die PDF-Vorlage. */
export async function loadCookbookDoc(
  cookbookId: string,
): Promise<{ doc: CookbookDoc; filename: string }> {
  const { data: cookbook, error: cbErr } = await db
    .from("cookbooks")
    .select("*")
    .eq("id", cookbookId)
    .maybeSingle();
  if (cbErr) throw new Error(cbErr.message);
  if (!cookbook) throw new Error("Kochbuch nicht gefunden");

  const { data: cRecipes, error: crErr } = await db
    .from("cookbook_recipes")
    .select(`sort_order, recipe:recipes(${RECIPE_SELECT})`)
    .eq("cookbook_id", cookbookId)
    .order("sort_order", { ascending: true });
  if (crErr) throw new Error(crErr.message);

  const rawRecipes = (cRecipes ?? []).map((r: any) => r.recipe).filter(Boolean);

  // Verlinkte Komponenten-Rezepte nachladen (eine Ebene tief), wie auf der Detailseite.
  const linkedIds = [
    ...new Set(
      rawRecipes.flatMap((r: any) =>
        (r.components ?? [])
          .map((c: any) => c.linked_recipe_id)
          .filter((id: string | null): id is string => !!id),
      ),
    ),
  ] as string[];
  const linkedById = new Map<string, any>();
  if (linkedIds.length > 0) {
    const { data: linked, error } = await db
      .from("recipes")
      .select(RECIPE_SELECT)
      .in("id", linkedIds);
    if (error) throw new Error(error.message);
    for (const l of linked ?? []) linkedById.set((l as any).id, withComponents(l, new Map()));
  }

  return {
    doc: {
      title: cookbook.title,
      description: cookbook.description,
      cover: imageRef("cookbook-covers", cookbook.cover_image_url),
      recipes: rawRecipes.map((r: any) => toRecipe(withComponents(r, linkedById))),
    },
    filename: `${slugify(cookbook.title)}.pdf`,
  };
}
