import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { userProfileQuery } from "@/lib/nutritionTargets";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { applyGlassMode } from "@/lib/theme";

/**
 * Experimenteller Glass-Modus: nur für Admins sichtbar/schaltbar, wendet bei
 * Aktivierung app-weit die `.glass`-Klasse an (siehe src/styles.css).
 */
export function useExperimentalMode() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const profileQuery = useQuery({ ...userProfileQuery(), staleTime: 60_000 });

  const raw = (profileQuery.data as { experimental_glass_ui?: unknown } | null)
    ?.experimental_glass_ui;
  const enabled = isAdmin && raw === true;

  // Kein Cleanup hier: dieser Hook läuft gleichzeitig im Shell (dauerhaft) UND
  // auf der Experimental-Settings-Seite (nur während sie sichtbar ist). Ein
  // Cleanup würde beim Verlassen der Settings-Seite die Klasse fälschlich
  // entfernen, obwohl der Shell-Zustand weiterhin "enabled" ist.
  useEffect(() => {
    applyGlassMode(enabled);
  }, [enabled]);

  const mutation = useMutation({
    mutationFn: async (value: boolean) => {
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("user_profile")
        .update({ experimental_glass_ui: value })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    isAdmin,
    enabled,
    setEnabled: (value: boolean) => mutation.mutate(value),
    isSaving: mutation.isPending,
  };
}
