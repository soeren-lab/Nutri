import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Tabellen mit user_id-Spalte, die beim Account-Löschen geleert werden. */
const USER_TABLES = [
  "achievements",
  "body_measurements",
  "points_log",
  "shopping_list_items",
  "quick_entry_templates",
  "meal_plan_entries",
  "favorites",
  "target_history",
  "user_points",
  "user_profile",
  "user_roles",
  "cookbook_members",
  "cookbooks",
  "recipes",
  "ingredients_master",
  "brands",
] as const;

/** Löscht alle Daten des angemeldeten Users und danach den Auth-Account. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const userId = context.userId;

    for (const table of USER_TABLES) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq("user_id", userId);
      // Fremdschlüssel-Reste ignorieren wir nicht still: harte Fehler melden.
      if (error && error.code !== "42P01") throw new Error(error.message);
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      userId,
    );
    if (authError) throw new Error(authError.message);

    return { ok: true } as const;
  });
