import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  importOffProduct,
  offSearchQuery,
  type OffProduct,
} from "@/lib/openfoodfacts";
import type { IngredientMaster } from "@/lib/ingredients-master";
import { cn } from "@/lib/utils";
import { isNativeApp } from "@/lib/platform";

function useDebounced(value: string, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Quellen-Tag im gleichen Muster wie der Community-Tag, nur andersfarbig. */
export function OffSourceTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border border-accent/50 px-2 py-0.5 text-[10px] font-medium text-accent",
        className,
      )}
    >
      Open Food Facts
    </span>
  );
}

function useOffImport(onImported?: (m: IngredientMaster) => void) {
  const qc = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (p: OffProduct) => importOffProduct(p),
    onMutate: (p) => setPendingId(p.id),
    onSettled: () => setPendingId(null),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["ingredients_master"] });
      qc.invalidateQueries({ queryKey: ["brands"] });
      toast.success(`„${m.name}" übernommen`);
      onImported?.(m);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import fehlgeschlagen"),
  });
  return { mut, pendingId };
}

function OffThumb({ url, size }: { url: string | null; size: "sm" | "md" }) {
  const cls = size === "md" ? "h-16 w-16 rounded-xl" : "h-9 w-9 rounded-md";
  return (
    <div className={cn("shrink-0 overflow-hidden border border-border bg-muted", cls)}>
      {url ? (
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function nutritionLine(p: OffProduct) {
  return `${p.calories ?? "–"} kcal / 100${p.unit}`;
}

/** Kompakte Makro-Zeile (P/KH/F) – nur wenn mindestens ein Wert bekannt ist. */
function macroLine(p: OffProduct): string | null {
  if (p.protein_g == null && p.carbs_g == null && p.fat_g == null) return null;
  const round = (v: number | null) => (v == null ? "–" : Math.round(v * 10) / 10);
  return `P ${round(p.protein_g)}g · KH ${round(p.carbs_g)}g · F ${round(p.fat_g)}g`;
}

/**
 * Open-Food-Facts-Treffer, die die normale Ergebnisliste ergänzen.
 * Werden immer NACH den eigenen/Community-Zutaten gerendert.
 *
 * variant "rows"  → kompakte Zeilen für das SearchSheet (als <li> Elemente)
 * variant "cards" → Karten für die Zutaten-Übersicht (als <li> Elemente)
 */
export function OffResultsSection({
  query,
  onImported,
  variant = "rows",
}: {
  query: string;
  onImported?: (m: IngredientMaster) => void;
  variant?: "rows" | "cards";
}) {
  const debounced = useDebounced(query.trim());
  const native = isNativeApp();
  const { data, isFetching } = useQuery({ ...offSearchQuery(debounced), enabled: !native });
  const { mut, pendingId } = useOffImport(onImported);

  // In der App-Version aktuell nicht verfügbar (braucht einen erreichbaren
  // eigenen Server) – die lokale/Community-Suche funktioniert unverändert.
  if (native) return null;
  if (debounced.length < 2) return null;

  const products = data?.products ?? [];

  if (products.length === 0) {
    if (!isFetching) return null;
    return (
      <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Open Food Facts wird durchsucht…
      </li>
    );
  }

  return (
    <>
      {products.map((p) => {
        const busy = pendingId === p.id;
        const action = (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-1.5"
            disabled={mut.isPending}
            onClick={(e) => {
              e.stopPropagation();
              mut.mutate(p);
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Übernehmen
          </Button>
        );

        if (variant === "cards") {
          return (
            <li
              key={p.id}
              className="rounded-2xl border border-border bg-card p-3 transition-colors hover:border-accent/40"
            >
              <div className="flex items-start gap-3">
                <OffThumb url={p.imageUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold leading-tight">
                        {p.name}
                      </div>
                      {p.brand && (
                        <div className="mt-0.5 truncate text-sm text-muted-foreground">
                          {p.brand}
                        </div>
                      )}
                    </div>
                    <OffSourceTag />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">{nutritionLine(p)}</span>
                    {action}
                  </div>
                </div>
              </div>
            </li>
          );
        }

        return (
          <li key={p.id}>
            <div className="flex w-full items-center gap-2 rounded-lg px-2 py-2">
              <OffThumb url={p.imageUrl} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm">{p.name}</span>
                  <OffSourceTag />
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {p.brand ? `${p.brand} · ` : ""}
                  {nutritionLine(p)}
                </span>
                {macroLine(p) && (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {macroLine(p)}
                  </span>
                )}
              </span>
              {action}
            </div>
          </li>
        );
      })}
    </>
  );
}
