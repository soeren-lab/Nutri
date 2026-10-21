import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { db } from "@/lib/db-client";

/**
 * Zentraler Daten-Client. Sprechende Alias-Datei: Die Aufrufe laufen jetzt gegen die eigene
 * NAS-API (src/lib/db-client.ts), die Typen (`Database`) bleiben für die Tabellen erhalten.
 */
export const supabase = db as unknown as SupabaseClient<Database>;
