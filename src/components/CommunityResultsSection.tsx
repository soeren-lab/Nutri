import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IngredientThumb } from "@/components/IngredientThumb";
import {
  communityIngredientsQuery,
  importCommunityIngredient,
  type CommunityIngredient,
} from "@/lib/community";
import type { IngredientMaster } from "@/lib/ingredients-master";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 8;

/** Quellen-Tag im gleichen Muster wie OffSourceTag (siehe OffResultsSection.tsx). */
export function CommunitySourceTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary",
        className,
      )}
    >
      Community
    </span>
  );
}

/**
 * Community-Zutaten, die die eigene Ergebnisliste ergänzen – nach dem
 * Vorbild von OffResultsSection.tsx (gleiches Rows-Layout als <li>-Einträge
 * fürs SearchSheet). Wird von den Aufrufern bewusst nur gerendert, wenn die
 * eigene Suche nichts findet (siehe IngredientSelect.tsx/planner.tsx).
 */
export function CommunityResultsSection({
  query,
  onImported,
}: {
  query: string;
  onImported?: (m: IngredientMaster) => void;
}) {
  const qc = useQueryClient();
  const { data: list = [], isFetching } = useQuery(communityIngredientsQuery());
  const [pendingId, setPendingId] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (src: CommunityIngredient) => importCommunityIngredient(src),
    onMutate: (src) => setPendingId(src.id),
    onSettled: () => setPendingId(null),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["ingredients_master"] });
      qc.invalidateQueries({ queryKey: ["brands"] });
      toast.success(`„${m.name}" übernommen`);
      onImported?.(m);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import fehlgeschlagen"),
  });

  const q = query.trim().toLowerCase();
  if (q.length < 2) return null;

  const matches = list
    .filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.brand?.name ?? "").toLowerCase().includes(q) ||
        (m.author_username ?? "").toLowerCase().includes(q),
    )
    .slice(0, MAX_RESULTS);

  if (matches.length === 0) {
    if (!isFetching) return null;
    return (
      <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Community wird durchsucht…
      </li>
    );
  }

  return (
    <>
      {matches.map((m) => {
        const busy = pendingId === m.id;
        return (
          <li key={m.id}>
            <div className="flex w-full items-center gap-2 rounded-lg px-2 py-2">
              <IngredientThumb path={m.image_url} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm">{m.name}</span>
                  <CommunitySourceTag />
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {m.brand ? `${m.brand.name} · ` : ""}
                  {m.calories != null ? `${m.calories} kcal / 100${m.unit}` : "keine Nährwerte"}
                </span>
                {(m.protein_g != null || m.carbs_g != null || m.fat_g != null) && (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    P {m.protein_g ?? "–"}g · KH {m.carbs_g ?? "–"}g · F {m.fat_g ?? "–"}g
                  </span>
                )}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 gap-1.5"
                disabled={mut.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  mut.mutate(m);
                }}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Übernehmen
              </Button>
            </div>
          </li>
        );
      })}
    </>
  );
}
