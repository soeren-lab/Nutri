import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { recipesQuery } from "@/lib/recipes";
import {
  extractSideDishes,
  findSideDishCandidates,
  type SideDishCandidate,
} from "@/lib/sideDishMigration";

/**
 * Einmalige Migration: Beilagen-Komponenten werden zu eigenen Rezepten
 * und aus dem Ursprungsrezept entfernt – mit Bestätigung pro Rezept.
 */
export function SideDishMigrationSection() {
  const qc = useQueryClient();
  const { data: recipes = [], isLoading } = useQuery(recipesQuery());
  const candidates = useMemo(() => findSideDishCandidates(recipes), [recipes]);
  const [pending, setPending] = useState<SideDishCandidate | null>(null);

  const extract = useMutation({
    mutationFn: (c: SideDishCandidate) => extractSideDishes(c),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Beilage entkoppelt");
      setPending(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || candidates.length === 0) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Beilagen entkoppeln</h2>
        <p className="text-xs text-muted-foreground">
          {candidates.length} {candidates.length === 1 ? "Rezept" : "Rezepte"} enthalten eine
          Beilagen-Komponente. Diese wird als eigenes Rezept angelegt und aus dem Rezept entfernt –
          Beilagen planst du danach separat im Planer.
        </p>
      </div>
      <ul className="space-y-2">
        {candidates.map((c) => (
          <li
            key={c.recipe.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{c.recipe.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {c.components.map((x) => x.name).join(", ")}
              </span>
            </span>
            <Button size="sm" variant="outline" onClick={() => setPending(c)}>
              <Utensils className="mr-1 h-4 w-4" /> Entkoppeln
            </Button>
          </li>
        ))}
      </ul>

      {pending && (
        <Dialog open onOpenChange={(v) => !v && setPending(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="truncate">{pending.recipe.title}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {pending.components.map((x) => `„${x.name}"`).join(", ")} wird zu einem eigenen Rezept
              mit Kategorie „Beilage" und aus „{pending.recipe.title}" entfernt.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPending(null)}>
                Abbrechen
              </Button>
              <Button
                className="flex-1"
                disabled={extract.isPending}
                onClick={() => extract.mutate(pending)}
              >
                Entkoppeln
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
