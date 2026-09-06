import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTracking } from "@/hooks/use-tracking";
import { MACRO_POINTS } from "@/lib/points";
import {
  TRACKABLE_KEYS,
  TRACKING_COLUMNS,
  TRACKING_LABELS,
  type TrackableMacroKey,
} from "@/lib/tracking";

/**
 * Individuell einstellbares Tracking: pro Nährwert-Kategorie lässt sich
 * festlegen, ob sie getrackt und fürs Punktesystem gewertet wird.
 * Kalorien sind immer aktiv.
 */
export function TrackingSettingsSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { tracking } = useTracking();

  const mutation = useMutation({
    mutationFn: async (payload: {
      key: TrackableMacroKey | "sugar_g";
      value: boolean;
    }) => {
      if (!user) throw new Error("Nicht angemeldet");
      const column = TRACKING_COLUMNS[payload.key];
      const patch =
        column === "track_protein"
          ? { track_protein: payload.value }
          : column === "track_carbs"
            ? { track_carbs: payload.value }
            : column === "track_fat"
              ? { track_fat: payload.value }
              : column === "track_fiber"
                ? { track_fiber: payload.value }
                : { track_sugar: payload.value };
      const { error } = await supabase
        .from("user_profile")
        .update(patch)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["user-profile"] });
      void qc.invalidateQueries({ queryKey: ["user-points"] });
      void qc.invalidateQueries({ queryKey: ["points-log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const maxBase =
    MACRO_POINTS.calories +
    TRACKABLE_KEYS.reduce(
      (sum, key) => sum + (tracking[key] ? MACRO_POINTS[key] : 0),
      0,
    );

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">Tracking</p>
        <p className="text-xs text-muted-foreground">
          Kalorien werden immer getrackt.
        </p>
      </div>

      <div className="divide-y divide-border/60">
        {TRACKABLE_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <Label htmlFor={`track-${key}`} className="text-sm">
                {TRACKING_LABELS[key]} tracken
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {MACRO_POINTS[key]} Punkte möglich
              </p>
            </div>
            <Switch
              id={`track-${key}`}
              checked={tracking[key]}
              disabled={mutation.isPending}
              onCheckedChange={(value) => mutation.mutate({ key, value })}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
        <div>
          <Label htmlFor="track-sugar_g" className="text-sm">
            Zucker anzeigen
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Nur Anzeige – Zucker gibt niemals Punkte
          </p>
        </div>
        <Switch
          id="track-sugar_g"
          checked={tracking.sugar_g}
          disabled={mutation.isPending}
          onCheckedChange={(value) => mutation.mutate({ key: "sugar_g", value })}
        />
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Deaktivierte Werte fließen nicht in deine Punkte ein – sie schaden dir aber
          auch nicht. Je mehr du trackst, desto mehr Punkte kannst du maximal
          erreichen. Aktuell max. <strong>{maxBase} Basispunkte</strong> pro Tag.
        </span>
      </p>
    </section>
  );
}
