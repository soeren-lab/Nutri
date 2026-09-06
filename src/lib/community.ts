import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";
import type { IngredientMaster } from "@/lib/ingredients-master";
import type { Brand } from "@/lib/brands";
import { getAvatarSignedUrls } from "@/lib/avatar";
import { fetchSharedSourceIds, sharedSourceHasUpdate } from "@/lib/shared-sources";


export type CommunityIngredient = IngredientMaster & {
  brand: Brand | null;
  author_username?: string | null;
  author_avatar_url?: string | null;
};

export type AuthorProfile = { username: string; avatarUrl: string | null };

/**
 * Liefert eine Map user_id → { username, avatarUrl } für die übergebenen IDs
 * (Security-Definer-RPC + signierte Avatar-URLs).
 */
export async function fetchAuthorProfiles(
  userIds: string[],
): Promise<Map<string, AuthorProfile>> {
  const map = new Map<string, AuthorProfile>();
  if (userIds.length === 0) return map;
  const { data, error } = await supabase.rpc("get_user_avatars", {
    _user_ids: userIds,
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    user_id: string;
    username: string;
    avatar_url: string | null;
  }>;
  const urlMap = await getAvatarSignedUrls(
    rows.map((r) => r.avatar_url).filter((p): p is string => !!p),
  );
  for (const row of rows) {
    map.set(row.user_id, {
      username: row.username,
      avatarUrl: row.avatar_url ? urlMap.get(row.avatar_url) ?? null : null,
    });
  }
  return map;
}

/** Nur Usernamen (Kompatibilitäts-Helfer). */
export async function fetchUsernames(userIds: string[]): Promise<Map<string, string>> {
  const profiles = await fetchAuthorProfiles(userIds);
  return new Map(Array.from(profiles, ([id, p]) => [id, p.username]));
}


async function requireUid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Nicht angemeldet");
  return uid;
}

/** Alle veröffentlichten Zutaten anderer Nutzer (dedupliziert nach Name+Marke). */
export async function fetchCommunityIngredients(): Promise<CommunityIngredient[]> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Nicht angemeldet");

  const { data, error } = await supabase
    .from("ingredients_master")
    .select("*, brand:brands(*)")
    .eq("is_published", true)
    .eq("archived", false)
    .order("name", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as CommunityIngredient[];

  // Usernamen + Profilbilder der Ersteller laden
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const authorMap = await fetchAuthorProfiles(userIds);
  for (const r of rows) {
    const a = authorMap.get(r.user_id);
    r.author_username = a?.username ?? null;
    r.author_avatar_url = a?.avatarUrl ?? null;
  }


  const seen = new Set<string>();
  const out: CommunityIngredient[] = [];
  for (const r of rows) {
    const isOwn = r.user_id === uid;
    const key = `${normalizeName(r.name)}|${normalizeName(r.brand?.name ?? "")}`;
    if (isOwn) {
      out.push(r);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export const communityIngredientsQuery = () =>
  queryOptions({
    queryKey: ["community_ingredients"],
    queryFn: fetchCommunityIngredients,
  });

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[äöü]/g, (c) => ({ ä: "a", ö: "o", ü: "u" })[c] ?? c)
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

export function similarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const max = Math.max(x.length, y.length);
  return 1 - levenshtein(x, y) / max;
}

/** Fuzzy-Check gegen bereits veröffentlichte Zutaten (ohne eigene ID). */
export async function findSimilarPublished(
  name: string,
  excludeId?: string,
): Promise<{ id: string; name: string; score: number } | null> {
  const { data, error } = await supabase
    .from("ingredients_master")
    .select("id, name")
    .eq("is_published", true);
  if (error) throw error;
  let best: { id: string; name: string; score: number } | null = null;
  for (const row of data ?? []) {
    if (excludeId && row.id === excludeId) continue;
    const score = similarity(name, row.name);
    if (score >= 0.8 && (!best || score > best.score)) {
      best = { id: row.id, name: row.name, score };
    }
  }
  return best;
}

/** Veröffentlichen bzw. neue Version veröffentlichen (published_version + 1). */
export async function publishIngredient(id: string): Promise<IngredientMaster> {
  const { data: current, error: cErr } = await supabase
    .from("ingredients_master")
    .select("published_version, brand_id")
    .eq("id", id)
    .single();
  if (cErr) throw cErr;

  if (current.brand_id) {
    const { error: bErr } = await supabase
      .from("brands")
      .update({ is_published: true })
      .eq("id", current.brand_id);
    if (bErr) throw bErr;
  }

  const { data, error } = await supabase
    .from("ingredients_master")
    .update({
      is_published: true,
      published_version: (current.published_version ?? 0) + 1,
      published_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function unpublishIngredient(id: string): Promise<void> {
  const { error } = await supabase
    .from("ingredients_master")
    .update({ is_published: false })
    .eq("id", id);
  if (error) throw error;
}

/** Eigene Marke für eine veröffentlichte Fremd-Marke finden oder anlegen. */
async function resolveOwnBrand(uid: string, sourceBrand: Brand | null): Promise<string | null> {
  if (!sourceBrand) return null;
  const { data: own, error } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", uid);
  if (error) throw error;
  const match = (own ?? []).find(
    (b) => normalizeName(b.name) === normalizeName(sourceBrand.name),
  );
  if (match) return match.id;
  const { data: created, error: cErr } = await supabase
    .from("brands")
    .insert({ name: sourceBrand.name, user_id: uid })
    .select("*")
    .single();
  if (cErr) throw cErr;
  return created.id;
}

/** Kopie einer Community-Zutat in die eigene Zutatenliste. */
export async function importCommunityIngredient(
  source: CommunityIngredient,
): Promise<IngredientMaster> {
  const uid = await requireUid();
  const brandId = await resolveOwnBrand(uid, source.brand ?? null);

  const { data, error } = await supabase
    .from("ingredients_master")
    .insert({
      user_id: uid,
      name: source.name,
      brand_id: brandId,
      image_url: source.image_url,
      unit: source.unit,
      category: source.category,
      calories: source.calories,
      protein_g: source.protein_g,
      carbs_g: source.carbs_g,
      fat_g: source.fat_g,
      fiber_g: source.fiber_g,
      sugar_g: source.sugar_g,
      density_g_per_ml: source.density_g_per_ml,
      source_ingredient_id: source.id,
      imported_version: source.published_version,
      source_updated_at: source.updated_at,

      is_published: false,
      published_version: 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export type IngredientUpdate = {
  copy: IngredientMaster;
  source: IngredientMaster;
  /** "shared" = privat geteiltes Original (kein Versionszähler). */
  kind: "community" | "shared";
};

/** Eigene importierte Zutaten, bei denen das Original eine neuere Version hat. */
export async function fetchIngredientUpdates(): Promise<IngredientUpdate[]> {
  const uid = await requireUid();
  const { data: copies, error } = await supabase
    .from("ingredients_master")
    .select("*")
    .eq("user_id", uid)
    .eq("archived", false)
    .not("source_ingredient_id", "is", null);
  if (error) throw error;
  if (!copies || copies.length === 0) return [];

  const ids = Array.from(new Set(copies.map((c) => c.source_ingredient_id!)));
  const { data: sources, error: sErr } = await supabase
    .from("ingredients_master")
    .select("*")
    .in("id", ids);
  if (sErr) throw sErr;
  const shared = await fetchSharedSourceIds();
  const byId = new Map((sources ?? []).map((s) => [s.id, s]));

  const out: IngredientUpdate[] = [];
  for (const copy of copies) {
    const source = byId.get(copy.source_ingredient_id!);
    if (!source) continue;
    if (source.is_published) {
      const sv = source.published_version ?? 0;
      const iv = copy.imported_version ?? 0;
      const dv = copy.dismissed_version ?? 0;
      if (sv > iv && sv > dv) out.push({ copy, source, kind: "community" });
    } else if (shared.ingredients.has(source.id)) {
      if (
        sharedSourceHasUpdate(
          source.updated_at,
          copy.source_updated_at,
          copy.dismissed_source_updated_at,
        )
      )
        out.push({ copy, source, kind: "shared" });
    }
  }
  return out;
}


export const ingredientUpdatesQuery = () =>
  queryOptions({
    queryKey: ["ingredient_updates"],
    queryFn: fetchIngredientUpdates,
  });

export async function applyIngredientUpdate(update: IngredientUpdate): Promise<void> {
  const { copy, source } = update;
  const { error } = await supabase
    .from("ingredients_master")
    .update({
      name: source.name,
      unit: source.unit,
      category: source.category,
      calories: source.calories,
      protein_g: source.protein_g,
      carbs_g: source.carbs_g,
      fat_g: source.fat_g,
      fiber_g: source.fiber_g,
      sugar_g: source.sugar_g,
      density_g_per_ml: source.density_g_per_ml,
      image_url: source.image_url,
      imported_version: source.published_version ?? 0,
      dismissed_version: null,
      source_updated_at: source.updated_at,
      dismissed_source_updated_at: null,

    })
    .eq("id", copy.id);
  if (error) throw error;
}

export async function dismissIngredientUpdate(update: IngredientUpdate): Promise<void> {
  const { error } = await supabase
    .from("ingredients_master")
    .update({
      dismissed_version: update.source.published_version ?? 0,
      dismissed_source_updated_at: update.source.updated_at,
    })

    .eq("id", update.copy.id);
  if (error) throw error;
}

export type DiffField = {
  key: string;
  label: string;
  before: string;
  after: string;
  kind?: "text" | "image";
};

const DIFF_FIELDS: Array<{
  key: keyof IngredientMaster;
  label: string;
  suffix?: string;
  kind?: "text" | "image";
}> = [
  { key: "name", label: "Name" },
  { key: "image_url", label: "Bild", kind: "image" },
  { key: "unit", label: "Basis-Einheit" },
  { key: "category", label: "Kategorie" },
  { key: "calories", label: "Kalorien", suffix: " kcal" },
  { key: "protein_g", label: "Protein", suffix: " g" },
  { key: "carbs_g", label: "Kohlenhydrate", suffix: " g" },
  { key: "fat_g", label: "Fett", suffix: " g" },
  { key: "fiber_g", label: "Ballaststoffe", suffix: " g" },
  { key: "density_g_per_ml", label: "Dichte", suffix: " g/ml" },
];

export function diffIngredient(
  copy: IngredientMaster,
  source: IngredientMaster,
): DiffField[] {
  const out: DiffField[] = [];
  for (const f of DIFF_FIELDS) {
    const a = copy[f.key] ?? null;
    const b = source[f.key] ?? null;
    if (a === b) continue;
    if (f.kind === "image") {
      out.push({
        key: String(f.key),
        label: f.label,
        before: typeof a === "string" ? a : "",
        after: typeof b === "string" ? b : "",
        kind: "image",
      });
      continue;
    }
    const fmt = (v: unknown) => (v == null || v === "" ? "–" : `${v}${f.suffix ?? ""}`);
    out.push({ key: String(f.key), label: f.label, before: fmt(a), after: fmt(b) });
  }
  return out;
}
