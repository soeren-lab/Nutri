import { supabase } from "@/integrations/supabase/client";

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

/** Prüft Format lokal; gibt Fehlermeldung (de) oder null zurück. */
export function validateUsername(value: string): string | null {
  const v = value.trim();
  if (v.length < 3) return "Mindestens 3 Zeichen";
  if (v.length > 20) return "Maximal 20 Zeichen";
  if (!USERNAME_PATTERN.test(v))
    return "Nur Buchstaben, Zahlen und Unterstrich – keine Leerzeichen";
  return null;
}

export type UsernameInfo = {
  username: string | null;
  changedAt: string | null;
};

/** Sperrfrist zwischen zwei Username-Änderungen. */
export const USERNAME_CHANGE_COOLDOWN_DAYS = 14;

/** Datum, ab dem wieder geändert werden darf – null, wenn sofort erlaubt. */
export function usernameLockedUntil(changedAt: string | null | undefined): Date | null {
  if (!changedAt) return null;
  const next = new Date(new Date(changedAt).getTime() + USERNAME_CHANGE_COOLDOWN_DAYS * 86_400_000);
  return next.getTime() > Date.now() ? next : null;
}

/** Username des eingeloggten Users (null = noch keiner gesetzt). */
export function usernameQuery(userId: string | undefined) {
  return {
    queryKey: ["username", userId ?? "anon"],
    enabled: !!userId,
    queryFn: async (): Promise<UsernameInfo> => {
      const { data, error } = await supabase
        .from("user_profile")
        .select("username, username_changed_at")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return {
        username: data?.username ?? null,
        changedAt: data?.username_changed_at ?? null,
      };
    },
  };
}

/** Live-Verfügbarkeitsprüfung über alle User hinweg (Security-Definer-RPC). */
export async function isUsernameAvailable(value: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_username_available", {
    _username: value.trim(),
  });
  if (error) throw error;
  return data === true;
}

/** Speichert den Username im Profil des Users. */
export async function saveUsername(
  userId: string,
  value: string,
  options: { isChange?: boolean } = {},
) {
  const username = value.trim();
  const err = validateUsername(username);
  if (err) throw new Error(err);
  const { error } = await supabase
    .from("user_profile")
    .upsert(
      {
        user_id: userId,
        username,
        ...(options.isChange ? { username_changed_at: new Date().toISOString() } : {}),
      },
      { onConflict: "user_id" },
    );
  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate"))
      throw new Error("Dieser Username ist bereits vergeben");
    throw error;
  }
  return username;
}
