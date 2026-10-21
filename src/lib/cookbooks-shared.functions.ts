import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/db/auth-middleware";

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

/**
 * Kochbuch-Freigabe per Link: lief früher mit einem Admin-Zugriff am Cloudflare-Worker.
 * Muss noch auf die NAS-API migriert werden (siehe ROADMAP.md, "Nacharbeit nach dem NAS-Umzug").
 */
const MIGRATION_PENDING =
  "Die Kochbuch-Freigabe per Link wird gerade auf das neue System migriert und ist vorübergehend nicht verfügbar.";

export const getCookbookByShareToken = createServerFn({ method: "GET" })
  .inputValidator((d) => tokenSchema.parse(d))
  .handler(async (): Promise<SharedCookbookPayload | null> => {
    throw new Error(MIGRATION_PENDING);
  });

export const joinCookbookServerFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => tokenSchema.parse(d))
  .handler(async (): Promise<{ joined: boolean; cookbook_id: string }> => {
    throw new Error(MIGRATION_PENDING);
  });
