import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userProfileQuery } from "@/lib/nutritionTargets";
import { db } from "@/integrations/db/client";
import { useAuth } from "@/hooks/use-auth";
import {
  applyTheme,
  isThemePreference,
  readStoredTheme,
  storeTheme,
  type ThemePreference,
} from "@/lib/theme";

/**
 * Der klassische Hell/Dunkel/System-Modus ist tot geschaltet: Liquid Glass
 * (siehe use-experimental-mode.ts) ist jetzt der verpflichtende Standard-Look
 * und überstimmt ihn optisch ohnehin per CSS-Reihenfolge (src/styles.css).
 * `theme` ist deshalb hart auf `"light"` verdrahtet – zusätzliche
 * Absicherung, falls `.glass`/`.glass-light` aus irgendeinem Grund mal nicht
 * greift, damit der unsichtbare Unterbau nie auf Dunkel/System zurückfällt.
 * `setTheme`/die Mutation/`storeTheme`/`readStoredTheme` bleiben als toter,
 * aber vorhandener Pfad bestehen (nicht gelöscht) – aufgerufen wird das
 * inzwischen von nirgends mehr, da AppearanceSection.tsx nicht mehr verlinkt
 * ist.
 */
export function useTheme() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const profileQuery = useQuery({ ...userProfileQuery(), staleTime: 60_000 });
  const [local, setLocal] = useState<ThemePreference>("system");

  // Lokalen Wert nach der Hydration anwenden (toter Pfad, siehe oben).
  useEffect(() => {
    const stored = readStoredTheme();
    setLocal(stored);
    applyTheme("light");
  }, []);

  const raw = (profileQuery.data as { theme_preference?: unknown } | null)?.theme_preference;
  const remote: ThemePreference | null = isThemePreference(raw) ? raw : null;
  const theme: ThemePreference = "light";

  useEffect(() => {
    if (!remote) return;
    storeTheme(remote);
    setLocal(remote);
    applyTheme("light");
  }, [remote]);

  const mutation = useMutation({
    mutationFn: async (pref: ThemePreference) => {
      if (!user) return;
      const { error } = await db
        .from("user_profile")
        .upsert({ user_id: user.id, theme_preference: pref } as never, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });

  function setTheme(pref: ThemePreference) {
    setLocal(pref);
    storeTheme(pref);
    applyTheme(pref, true);
    mutation.mutate(pref);
  }

  return { theme, setTheme, isSaving: mutation.isPending };
}
