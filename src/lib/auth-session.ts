import { supabase } from "@/integrations/supabase/client";

/**
 * Liest die User-ID direkt aus der von supabase-js persistierten Session
 * (kein Netzwerk-Roundtrip, funktioniert offline) – dieselbe Quelle, die auch
 * `useAuth()` verwendet. `null` bei fehlender Session (kein Fehler-Wurf,
 * damit Hintergrund-Aufgaben ohne Login einfach still nichts tun).
 */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
