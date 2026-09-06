import { z } from "zod";

const optionalNonNegNumber = z
  .union([z.number().nonnegative(), z.nan()])
  .optional()
  .transform((v) => (v === undefined || Number.isNaN(v) ? null : v));

export const ingredientSchema = z.object({
  name: z.string().trim().min(1, "Name erforderlich").max(120),
  // Menge ist Pflicht: fehlende Mengen führten in der Einkaufsliste zu Lücken.
  amount: z
    .union([z.number(), z.nan(), z.undefined()])
    .refine((v) => typeof v === "number" && !Number.isNaN(v) && v > 0, "Menge erforderlich")
    .transform((v) => v as number),


  unit: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  ingredient_master_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  product_group: z
    .string()
    .trim()
    .max(80)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),

  calories: optionalNonNegNumber,
  protein_g: optionalNonNegNumber,
  carbs_g: optionalNonNegNumber,
  fat_g: optionalNonNegNumber,
  fiber_g: optionalNonNegNumber,
  sugar_g: optionalNonNegNumber,
});

export const stepSchema = z.object({
  instruction: z.string().trim().min(1, "Anleitung erforderlich").max(2000),
});

export const recipeFormSchema = z.object({
  title: z.string().trim().min(1, "Titel erforderlich").max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  // Freitext – keine Enum-Einschränkung (Kategorien sind reine Textwerte).
  category: z.string().trim().max(40).optional().or(z.literal("")),
  categories: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  tag: z.string().trim().max(40).optional().transform((v) => (v && v.length > 0 ? v : null)),
  servings: z
    .union([z.number().int().positive(), z.nan()])
    .optional()
    .transform((v) => (v === undefined || Number.isNaN(v) ? null : v)),
  prep_time_minutes: z
    .union([z.number().int().nonnegative(), z.nan()])
    .optional()
    .transform((v) => (v === undefined || Number.isNaN(v) ? null : v)),
  cook_time_minutes: z
    .union([z.number().int().nonnegative(), z.nan()])
    .optional()
    .transform((v) => (v === undefined || Number.isNaN(v) ? null : v)),
  calories: optionalNonNegNumber,
  protein_g: optionalNonNegNumber,
  carbs_g: optionalNonNegNumber,
  fat_g: optionalNonNegNumber,
  fiber_g: optionalNonNegNumber,
  sugar_g: optionalNonNegNumber,
  // Freie Zutaten (ohne Komponente) – dürfen leer sein, wenn Komponenten existieren.
  ingredients: z.array(ingredientSchema).default([]),
  steps: z.array(stepSchema).min(1, "Mindestens ein Schritt"),
});

export type RecipeFormValues = z.input<typeof recipeFormSchema>;
export type RecipeFormParsed = z.output<typeof recipeFormSchema>;
