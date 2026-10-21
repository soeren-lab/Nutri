import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/db/auth-middleware";

/** Speichert/aktualisiert den FCM-Token des aktuellen Geräts für den angemeldeten User. */
export const registerPushToken = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ token: z.string().min(1), platform: z.string().min(1) }).parse(input),
  )
  .middleware([requireAuth])
  .handler(async ({ context, data }) => {
    // RLS erlaubt Insert/Update der eigenen Zeile (user_id = auth.uid()) -
    // kein service_role-Client nötig.
    const { error } = await context.db.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        fcm_token: data.token,
        platform: data.platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,fcm_token" },
    );
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

/**
 * Schickt eine "App aktualisieren"-Push-Notification an alle Accounts außer dem
 * Absender. Nur für Admins - geprüft innerhalb der security-definer-Funktion
 * get_other_push_tokens (siehe Migration), nicht nur im UI versteckt.
 */
export const broadcastAppUpdate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data: subs, error } = await context.db.rpc("get_other_push_tokens", {
      _exclude_user_id: context.userId,
    });
    if (error) throw new Error(error.message);

    const tokens = (subs ?? []).map((s) => s.fcm_token);
    const { sendFcmBroadcast } = await import("@/lib/fcm.server");
    return sendFcmBroadcast(tokens, {
      title: "App aktualisieren",
      body: "Eine neue Version ist verfügbar. Bitte die App aktualisieren.",
    });
  });
