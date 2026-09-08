import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  archiveIngredientMaster,
  countIngredientMasterUsage,
  type IngredientMaster,
} from "@/lib/ingredients-master";
import { toast } from "sonner";
import { useSwipePriority } from "@/hooks/use-swipe-priority";

/**
 * Löschflow für Stammzutaten (Soft-Delete):
 * Immer erst bestätigen, dann wird die Zutat archiviert (archived=true).
 * Rezepte, die sie verwenden, funktionieren unverändert weiter.
 */
export function IngredientDeleteDialog({
  ingredient,
  open,
  onOpenChange,
  onDone,
}: {
  ingredient: IngredientMaster | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [usage, setUsage] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !ingredient) return;
    let cancelled = false;
    setUsage(null);
    countIngredientMasterUsage(ingredient.id)
      .then((count) => {
        if (!cancelled) setUsage(count);
      })
      .catch(() => {
        if (!cancelled) setUsage(0);
      });
    return () => {
      cancelled = true;
    };
  }, [open, ingredient]);

  const archiveMut = useMutation({
    onMutate: () => {
      const previous = qc.getQueriesData<IngredientMaster[]>({ queryKey: ["ingredients_master"] });
      qc.setQueriesData(
        { queryKey: ["ingredients_master"] },
        (old: IngredientMaster[] | undefined) =>
          (old ?? []).map((m) => (m.id === ingredient!.id ? { ...m, archived: true } : m)),
      );
      toast.success("Zutat gelöscht");
      onDone?.();
      onOpenChange(false);
      return { previous };
    },
    mutationFn: () => archiveIngredientMaster(ingredient!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients_master"] });
    },
    onError: (e, _vars, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(e instanceof Error ? e.message : "Fehler");
    },
  });

  useSwipePriority(
    open
      ? { onSwipeLeft: () => onOpenChange(false), onSwipeRight: () => onOpenChange(false) }
      : null,
  );

  if (!ingredient) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Zutat wirklich löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            „{ingredient.name}" wird aus deiner Zutatenliste entfernt (archiviert).
            {usage === null
              ? " Verwendung wird geprüft…"
              : usage > 0
                ? ` Hinweis: Die Zutat wird aktuell in ${usage} Rezept${usage === 1 ? "" : "en"} verwendet – diese funktionieren unverändert weiter.`
                : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archiveMut.isPending}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              archiveMut.mutate();
            }}
            disabled={archiveMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {archiveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
