import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { convert, normalizeUnit } from "@/lib/unitConversion";

export type TypicalAmounts = Map<string, number>;

/**
 * Durchschnittlich verwendete Menge je Stammzutat (auf die Basis-Einheit der
 * Stammzutat umgerechnet) über alle eigenen Rezepte.
 */
export async function fetchTypicalAmounts(): Promise<TypicalAmounts> {
  const { data, error } = await supabase
    .from("ingredients")
    .select(
      "amount, unit, ingredient_master_id, master:ingredients_master!inner(unit, density_g_per_ml), recipes!inner(user_id)",
    )
    .not("ingredient_master_id", "is", null)
    .not("amount", "is", null);
  if (error) throw error;

  const acc = new Map<string, { sum: number; n: number }>();
  for (const row of (data ?? []) as unknown as Array<{
    amount: number | null;
    unit: string | null;
    ingredient_master_id: string | null;
    master: { unit: string; density_g_per_ml: number | null } | null;
  }>) {
    const id = row.ingredient_master_id;
    if (!id || row.amount == null || !row.master) continue;
    const mu = normalizeUnit(row.master.unit);
    const ru = row.unit && row.unit.length > 0 ? normalizeUnit(row.unit) : mu;
    const inBase = convert(Number(row.amount), ru, mu, row.master.density_g_per_ml ?? 1);
    if (inBase == null || inBase <= 0) continue;
    const cur = acc.get(id) ?? { sum: 0, n: 0 };
    cur.sum += inBase;
    cur.n += 1;
    acc.set(id, cur);
  }

  const out: TypicalAmounts = new Map();
  for (const [id, { sum, n }] of acc) out.set(id, sum / n);
  return out;
}

export function useIngredientTypicalAmounts(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ingredient-typical-amounts", user?.id],
    queryFn: fetchTypicalAmounts,
    enabled: enabled && !!user,
    staleTime: 5 * 60 * 1000,
  });
}
