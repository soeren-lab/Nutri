import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type QuickEntryTemplate = Tables<"quick_entry_templates">;

/** Werte eines Schnelleintrags. */
export type QuickEntryValues = {
  name: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
};

/**
 * Grobe Schätzwerte für typische Gerichte (pro üblicher Portion).
 * Fallback, wenn der Nutzer noch keine eigene Vorlage hat.
 */
export const COMMON_DISHES: Array<QuickEntryValues & { hint: string }> = [
  { name: "Pizza", calories: 850, protein_g: 35, carbs_g: 95, fat_g: 35, fiber_g: 4, sugar_g: 12, hint: "ganze Pizza (ca. 30 cm)" },
  { name: "Burger", calories: 700, protein_g: 33, carbs_g: 50, fat_g: 38, fiber_g: 3, sugar_g: 14, hint: "Burger mit Rindfleisch" },
  { name: "Döner", calories: 750, protein_g: 40, carbs_g: 70, fat_g: 33, fiber_g: 6, sugar_g: 10, hint: "Döner im Brot" },
  { name: "Pasta", calories: 650, protein_g: 22, carbs_g: 85, fat_g: 22, fiber_g: 5, sugar_g: 12, hint: "Portion mit Sauce" },
  { name: "Sushi", calories: 500, protein_g: 25, carbs_g: 75, fat_g: 10, fiber_g: 3, sugar_g: 8, hint: "ca. 12 Stück" },
  { name: "Salat", calories: 350, protein_g: 15, carbs_g: 20, fat_g: 22, fiber_g: 7, sugar_g: 8, hint: "gemischt mit Dressing" },
  { name: "Curry", calories: 700, protein_g: 30, carbs_g: 75, fat_g: 28, fiber_g: 8, sugar_g: 15, hint: "mit Reis" },
  { name: "Burrito", calories: 800, protein_g: 35, carbs_g: 90, fat_g: 30, fiber_g: 9, sugar_g: 8, hint: "großer Burrito" },
  { name: "Ramen", calories: 600, protein_g: 28, carbs_g: 70, fat_g: 22, fiber_g: 4, sugar_g: 6, hint: "Schüssel mit Brühe" },
  { name: "Wrap", calories: 500, protein_g: 25, carbs_g: 50, fat_g: 20, fiber_g: 5, sugar_g: 6, hint: "gefüllter Wrap" },
];

export function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

/** Passende Vorlagen (Prefix/Teilstring), bereits nach Häufigkeit sortiert. */
export function matchTemplates(
  templates: QuickEntryTemplate[],
  search: string,
): QuickEntryTemplate[] {
  const q = normalizeName(search);
  if (!q) return templates.slice(0, 5);
  return templates.filter((t) => normalizeName(t.name).includes(q)).slice(0, 5);
}

export function matchCommonDishes(search: string) {
  const q = normalizeName(search);
  if (!q) return [];
  return COMMON_DISHES.filter((d) => normalizeName(d.name).includes(q)).slice(0, 5);
}

export const quickEntryTemplatesQuery = () =>
  queryOptions({
    queryKey: ["quick-entry-templates"],
    queryFn: fetchQuickEntryTemplates,
  });

export async function fetchQuickEntryTemplates(): Promise<QuickEntryTemplate[]> {
  const { data, error } = await supabase
    .from("quick_entry_templates")
    .select("*")
    .order("use_count", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Vorlage anlegen oder – bei gleichem Namen – aktualisieren und Zähler erhöhen. */
export async function upsertQuickEntryTemplate(
  userId: string,
  values: QuickEntryValues,
): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from("quick_entry_templates")
    .select("id, use_count")
    .eq("user_id", userId)
    .ilike("name", values.name.trim())
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const { error } = await supabase
      .from("quick_entry_templates")
      .update({ ...values, name: values.name.trim(), use_count: existing.use_count + 1 })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("quick_entry_templates")
    .insert({ ...values, name: values.name.trim(), user_id: userId });
  if (error) throw error;
}

export async function bumpTemplateUseCount(id: string, current: number): Promise<void> {
  const { error } = await supabase
    .from("quick_entry_templates")
    .update({ use_count: current + 1 })
    .eq("id", id);
  if (error) throw error;
}

export async function updateQuickEntryTemplate(
  id: string,
  values: QuickEntryValues,
): Promise<void> {
  const { error } = await supabase
    .from("quick_entry_templates")
    .update({ ...values, name: values.name.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteQuickEntryTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("quick_entry_templates").delete().eq("id", id);
  if (error) throw error;
}
