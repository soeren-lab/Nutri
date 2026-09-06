import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenSchema = z.object({ token: z.string().uuid() });

export type SharedCookbookPayload = {
  cookbook: {
    id: string;
    title: string;
    description: string | null;
    cover_image_url: string | null;
    share_token: string;
  };
  recipes: Array<{
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    prep_time_minutes: number | null;
    cook_time_minutes: number | null;
    servings: number | null;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    sugar_g: number | null;
    categories: string[];
    category: string | null;
    tag: string | null;
    user_id: string;
    nutrition_mode: string;
    created_at: string;
    updated_at: string;
  }>;
  coverSignedUrl: string | null;
  imageSignedUrls: Record<string, string | null>;
};

export const getCookbookByShareToken = createServerFn({ method: "GET" })
  .inputValidator((d) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<SharedCookbookPayload | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cb, error: cbErr } = await supabaseAdmin
      .from("cookbooks")
      .select("id, title, description, cover_image_url, share_token")
      .eq("share_token", data.token)
      .maybeSingle();
    if (cbErr) throw cbErr;
    if (!cb) return null;

    const { data: links, error: linkErr } = await supabaseAdmin
      .from("cookbook_recipes")
      .select("sort_order, recipe:recipes(*)")
      .eq("cookbook_id", cb.id)
      .order("sort_order", { ascending: true });
    if (linkErr) throw linkErr;

    const recipes = (links ?? [])
      .map((l) => l.recipe)
      .filter(Boolean) as SharedCookbookPayload["recipes"];

    let coverSignedUrl: string | null = null;
    if (cb.cover_image_url) {
      const { data: signed } = await supabaseAdmin.storage
        .from("cookbook-covers")
        .createSignedUrl(cb.cover_image_url, 60 * 60 * 24 * 7);
      coverSignedUrl = signed?.signedUrl ?? null;
    }

    const imageSignedUrls: Record<string, string | null> = {};
    for (const r of recipes) {
      if (r.image_url) {
        const { data: signed } = await supabaseAdmin.storage
          .from("recipe-images")
          .createSignedUrl(r.image_url, 60 * 60 * 24 * 7);
        imageSignedUrls[r.id] = signed?.signedUrl ?? null;
      }
    }

    return { cookbook: cb, recipes, coverSignedUrl, imageSignedUrls };
  });

export const joinCookbookServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => tokenSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cb } = await supabaseAdmin
      .from("cookbooks")
      .select("id, user_id")
      .eq("share_token", data.token)
      .maybeSingle();
    if (!cb) throw new Error("Ungültiger Link");
    if (cb.user_id === context.userId) return { joined: false, cookbook_id: cb.id };
    const { error } = await supabaseAdmin
      .from("cookbook_members")
      .upsert(
        { cookbook_id: cb.id, user_id: context.userId, role: "viewer" },
        { onConflict: "cookbook_id,user_id" },
      );
    if (error) throw error;
    return { joined: true, cookbook_id: cb.id };
  });
