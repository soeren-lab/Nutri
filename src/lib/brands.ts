import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { queryOptions } from "@tanstack/react-query";

export type Brand = Tables<"brands">;

export async function fetchBrands(): Promise<Brand[]> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", uid)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export const brandsQuery = () =>
  queryOptions({
    queryKey: ["brands"],
    queryFn: fetchBrands,
  });

export async function createBrand(name: string): Promise<Brand> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name erforderlich");
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Nicht angemeldet");
  const { data, error } = await supabase
    .from("brands")
    .insert({ name: trimmed, user_id: uid })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateBrand(id: string, name: string): Promise<Brand> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name erforderlich");
  const { data, error } = await supabase
    .from("brands")
    .update({ name: trimmed })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBrand(id: string): Promise<void> {
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) throw error;
}

export async function countBrandUsage(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("ingredients_master")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", id);
  if (error) throw error;
  return count ?? 0;
}
