import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userProfileQuery } from "@/lib/nutritionTargets";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  applyTheme,
  isThemePreference,
  readStoredTheme,
  storeTheme,
  type ThemePreference,
} from "@/lib/theme";

/**
 * Wendet die Darstellungs-Einstellung an: lokal gespeicherter Wert greift
 * sofort, der Profilwert (geräteübergreifend) überschreibt ihn nach dem Laden.
 */
export function useTheme() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const profileQuery = useQuery({ ...userProfileQuery(), staleTime: 60_000 });
  const [local, setLocal] = useState<ThemePreference>("system");

  // Lokalen Wert nach der Hydration anwenden.
  useEffect(() => {
    const stored = readStoredTheme();
    setLocal(stored);
    applyTheme(stored);
  }, []);

  const raw = (profileQuery.data as { theme_preference?: unknown } | null)
    ?.theme_preference;
  const remote: ThemePreference | null = isThemePreference(raw) ? raw : null;
  const theme = remote ?? local;

  useEffect(() => {
    if (!remote) return;
    storeTheme(remote);
    setLocal(remote);
    applyTheme(remote);
  }, [remote]);

  const mutation = useMutation({
    mutationFn: async (pref: ThemePreference) => {
      if (!user) return;
      const { error } = await supabase
        .from("user_profile")
        .upsert(
          { user_id: user.id, theme_preference: pref } as never,
          { onConflict: "user_id" },
        );
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
