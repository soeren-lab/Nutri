import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { userProfileQuery } from "@/lib/nutritionTargets";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { applyGlassMode, isGlassVariant, type GlassVariant } from "@/lib/theme";

/**
 * Experimenteller Glass-Modus: für alle angemeldeten Nutzer sicht-/schaltbar
 * (offiziell freigegeben, war zuvor nur für Admins), wendet bei Aktivierung
 * app-weit die `.glass`/`.glass-light`-Klasse an (siehe src/styles.css) –
 * Variante ist unabhängig von der normalen Hell/Dunkel-Wahl.
 */
export function useExperimentalMode() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const profileQuery = useQuery({ ...userProfileQuery(), staleTime: 60_000 });

  const data = profileQuery.data as {
    experimental_glass_ui?: unknown;
    experimental_glass_variant?: unknown;
  } | null;
  const enabled = data?.experimental_glass_ui === true;
  const variant: GlassVariant = isGlassVariant(data?.experimental_glass_variant)
    ? data.experimental_glass_variant
    : "dark";

  // Kein Cleanup hier: dieser Hook läuft gleichzeitig im Shell (dauerhaft) UND
  // auf der Experimental-Settings-Seite (nur während sie sichtbar ist). Ein
  // Cleanup würde beim Verlassen der Settings-Seite die Klasse fälschlich
  // entfernen, obwohl der Shell-Zustand weiterhin "enabled" ist.
  useEffect(() => {
    applyGlassMode(enabled, variant);
  }, [enabled, variant]);

  const enabledMutation = useMutation({
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

  const variantMutation = useMutation({
    mutationFn: async (value: GlassVariant) => {
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("user_profile")
        .update({ experimental_glass_variant: value })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    enabled,
    variant,
    setEnabled: (value: boolean) => enabledMutation.mutate(value),
    setVariant: (value: GlassVariant) => variantMutation.mutate(value),
    isSaving: enabledMutation.isPending || variantMutation.isPending,
  };
}
