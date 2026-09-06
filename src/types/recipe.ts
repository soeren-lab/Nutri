import type { Tables } from "@/integrations/supabase/types";

export type Recipe = Tables<"recipes">;
export type Ingredient = Tables<"ingredients">;
export type Step = Tables<"steps">;
export type Favorite = Tables<"favorites">;
export type IngredientMasterRow = Tables<"ingredients_master">;
export type RecipeComponent = Tables<"recipe_components">;
export type ComponentVariant = Tables<"component_variants">;

export type ComponentType = "fixed" | "choice";

export type IngredientWithMaster = Ingredient & {
  master: IngredientMasterRow | null;
};

export type NutritionMode = "simple" | "advanced";

export type RecipeListItem = Recipe & {
  ingredients: IngredientWithMaster[];
  components?: RecipeComponentWithRelations[];
  author_username?: string | null;
  author_avatar_url?: string | null;
};


/**
 * Eine Rezept-Komponente ("Sauce", "Beilage", …) mit eigener Portionsangabe.
 * Entweder inline (eigene Zutaten) oder verlinkt auf ein anderes Rezept.
 */
export type RecipeComponentWithRelations = RecipeComponent & {
  ingredients: IngredientWithMaster[];
  /** Varianten (nur bei component_type='choice'). */
  variants: ComponentVariant[];
  /** Rekursiv aufgelöstes verlinktes Rezept (nur bei linked_recipe_id). */
  linked: RecipeNode | null;
};

/** Rezept mit Zutaten und Komponenten – rekursiv verwendbar. */
export type RecipeNode = Recipe & {
  ingredients: IngredientWithMaster[];
  components: RecipeComponentWithRelations[];
};

export type RecipeWithRelations = RecipeNode & {
  steps: Step[];
};

export const RECIPE_CATEGORIES = [
  "Frühstück",
  "Vorspeise",
  "Hauptgericht",
  "Dessert",
  "Snack",
  "Getränk",
  "Beilage",
  "Sonstiges",
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
