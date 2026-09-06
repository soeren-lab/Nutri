import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  findSimilarPublished,
  publishIngredient,
  unpublishIngredient,
} from "@/lib/community";
import {
  findSimilarPublishedRecipe,
  publishRecipe,
  unpublishedLinkedRecipes,
  unpublishRecipe,
} from "@/lib/community-recipes";
import type { IngredientMaster } from "@/lib/ingredients-master";
import { toast } from "sonner";

export type PublishTarget = {
  kind: "ingredient" | "recipe";
  id: string;
  name: string;
  isPublished: boolean;
  publishedVersion: number;
};

export function ingredientTarget(m: IngredientMaster): PublishTarget {
  return {
    kind: "ingredient",
    id: m.id,
    name: m.name,
    isPublished: m.is_published,
    publishedVersion: m.published_version ?? 0,
  };
}

export function PublishButton({
  target,
  size = "sm",
}: {
  target: PublishTarget;
  size?: "sm" | "default";
}) {
  const qc = useQueryClient();
  const [similar, setSimilar] = useState<string | null>(null);
  const [linkedWarning, setLinkedWarning] = useState<string[] | null>(null);
  const isRecipe = target.kind === "recipe";

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["ingredients_master"] });
    qc.invalidateQueries({ queryKey: ["community_ingredients"] });
    qc.invalidateQueries({ queryKey: ["brands"] });
    qc.invalidateQueries({ queryKey: ["recipes"] });
    qc.invalidateQueries({ queryKey: ["community_recipes"] });
  }

  const publishMut = useMutation({
    mutationFn: async () => {
      if (isRecipe) {
        const r = await publishRecipe(target.id);
        return r.published_version ?? 1;
      }
      const m = await publishIngredient(target.id);
      return m.published_version ?? 1;
    },
    onSuccess: (version) => {
      invalidate();
      setSimilar(null);
      setLinkedWarning(null);
      toast.success(`Veröffentlicht (Version ${version})`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const checkMut = useMutation({
    mutationFn: async () => {
      const linked = isRecipe ? await unpublishedLinkedRecipes(target.id) : [];
      let matchName: string | null = null;
      if (!target.isPublished) {
        if (isRecipe) {
          const m = await findSimilarPublishedRecipe(target.name, target.id);
          matchName = m?.title ?? null;
        } else {
          const m = await findSimilarPublished(target.name, target.id);
          matchName = m?.name ?? null;
        }
      }
      return { linked: linked.map((l) => l.title), similar: matchName };

    },
    onSuccess: ({ linked, similar: match }) => {
      if (match) {
        setSimilar(match);
        return;
      }
      if (linked.length > 0) {
        setLinkedWarning(linked);
        return;
      }
      publishMut.mutate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const unpublishMut = useMutation({
    mutationFn: () => (isRecipe ? unpublishRecipe(target.id) : unpublishIngredient(target.id)),
    onSuccess: () => {
      invalidate();
      toast.success("Nicht mehr im Hub sichtbar");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const busy = checkMut.isPending || publishMut.isPending || unpublishMut.isPending;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size={size}
          variant={target.isPublished ? "outline" : "default"}
          disabled={busy}
          onClick={() => checkMut.mutate()}
          className="gap-1.5"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          {target.isPublished ? "Neue Version veröffentlichen" : "Veröffentlichen"}
        </Button>
        {target.isPublished && (
          <>
            <span className="text-xs text-muted-foreground">
              Im Hub · v{target.publishedVersion}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => unpublishMut.mutate()}
              className="text-muted-foreground"
            >
              Zurückziehen
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={similar !== null} onOpenChange={(o) => !o && setSimilar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRecipe ? "Ähnliches Rezept gefunden" : "Ähnliche Zutat gefunden"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRecipe ? "Ähnliches Rezept" : "Ähnliche Zutat"} „{similar}" existiert
              bereits im Hub. Trotzdem veröffentlichen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => publishMut.mutate()}>
              Trotzdem veröffentlichen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={linkedWarning !== null}
        onOpenChange={(o) => !o && setLinkedWarning(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verlinkte Beilage ist nicht öffentlich</AlertDialogTitle>
            <AlertDialogDescription>
              {linkedWarning?.join(", ")} – wird als eigenständige Kopie
              mitveröffentlicht, damit andere das Rezept vollständig nutzen können.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => publishMut.mutate()}>
              Trotzdem veröffentlichen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
