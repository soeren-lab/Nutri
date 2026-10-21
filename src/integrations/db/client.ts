import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { db as apiClient } from "@/lib/db-client";

/**
 * Zentraler Daten-Client: spricht mit der eigenen NAS-API (src/lib/db-client.ts).
 *
 * Der Typ stammt aus `@supabase/supabase-js` (nur als Typ-Hilfe im Entwicklungsbetrieb, kein
 * Laufzeit-Code) und `Database` beschreibt die Tabellen. So bleiben alle Abfragen typsicher.
 */
export const db = apiClient as unknown as SupabaseClient<Database>;
