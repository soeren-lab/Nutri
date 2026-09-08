import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Pencil, Trash2, Share2, Plus, X, ArrowLeft, BookOpen, Copy, Check, Download, Loader2, LogOut, Users } from "lucide-react";
import { usePdfExport } from "@/hooks/use-pdf-export";
import { isNativeApp } from "@/lib/platform";
import {
  cookbookQuery,
  cookbookRecipesQuery,
  getCookbookCoverSignedUrl,
  deleteCookbook,
  addRecipesToCookbook,
  removeRecipeFromCookbook,
  leaveCookbook,
} from "@/lib/cookbooks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipePickerModal } from "@/components/RecipePickerModal";
import { EmptyState } from "@/components/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ShareCookbookWithFriendsDialog } from "@/components/ShareCookbookWithFriendsDialog";

export const Route = createFileRoute("/_authenticated/cookbooks/$id/")({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(cookbookQuery(params.id));
    context.queryClient.ensureQueryData(cookbookRecipesQuery(params.id));
  },
  component: CookbookDetailPage,
  pendingComponent: () => (
    <div className="space-y-4">
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-8 w-40" />
    </div>
  ),
});

function CookbookDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: cookbook } = useSuspenseQuery(cookbookQuery(id));
  const { data: recipes } = useSuspenseQuery(cookbookRecipesQuery(id));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [friendShareOpen, setFriendShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pdfExport = usePdfExport();
  const { user } = useAuth();
  const isOwner = !!user && user.id === cookbook.user_id;

  const leaveMut = useMutation({
    mutationFn: () => leaveCookbook(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cookbooks"] });
      toast.success("Kochbuch verlassen");
      navigate({ to: "/recipes", search: { tab: "cookbooks" } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const { data: coverUrl } = useQuery({
    queryKey: ["cookbook-cover", cookbook.cover_image_url],
    queryFn: () =>
      cookbook.cover_image_url ? getCookbookCoverSignedUrl(cookbook.cover_image_url) : Promise.resolve(null),
    enabled: !!cookbook.cover_image_url,
  });

  const addMut = useMutation({
    mutationFn: (recipeIds: string[]) => addRecipesToCookbook(id, recipeIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cookbooks", id, "recipes"] });
      qc.invalidateQueries({ queryKey: ["cookbooks"] });
      toast.success("Rezepte hinzugefügt");
      setPickerOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const removeMut = useMutation({
    mutationFn: (recipeId: string) => removeRecipeFromCookbook(id, recipeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cookbooks", id, "recipes"] });
      qc.invalidateQueries({ queryKey: ["cookbooks"] });
      toast.success("Entfernt");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteCookbook(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cookbooks"] });
      toast.success("Kochbuch gelöscht");
      navigate({ to: "/recipes", search: { tab: "cookbooks" } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/cookbooks/shared/${cookbook.share_token}`
      : `/cookbooks/shared/${cookbook.share_token}`;

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/recipes"
        search={{ tab: "cookbooks" }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Zurück
      </Link>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative aspect-[3/1] w-full bg-muted sm:aspect-[4/1]">
          {coverUrl ? (
            <img src={coverUrl} alt={cookbook.title} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <BookOpen className="h-10 w-10" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            {!isOwner && (
              <span className="mb-1 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <Users className="h-3 w-3" /> Geteiltes Kochbuch (nur Ansicht)
              </span>
            )}
            <h1 className="text-2xl font-semibold tracking-tight">{cookbook.title}</h1>
            {cookbook.description && (
              <p className="mt-1 text-sm text-muted-foreground">{cookbook.description}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {recipes.length} Rezept{recipes.length === 1 ? "" : "e"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                isNativeApp()
                  ? toast.info("PDF-Export ist in der App-Version aktuell nicht verfügbar.")
                  : pdfExport.mutate(id)
              }
              disabled={pdfExport.isPending || recipes.length === 0}
              className="gap-1.5"
            >
              {pdfExport.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> PDF wird erstellt…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Herunterladen
                </>
              )}
            </Button>
            {isOwner && (
              <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} className="gap-1.5">
                <Share2 className="h-4 w-4" /> Teilen
              </Button>
            )}
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFriendShareOpen(true)}
                className="gap-1.5"
              >
                <Users className="h-4 w-4" /> Mit Freund teilen
              </Button>
            )}
            {isOwner && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to="/cookbooks/$id/edit" params={{ id }}>
                  <Pencil className="h-4 w-4" /> Bearbeiten
                </Link>
              </Button>
            )}
            {!isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive">
                    <LogOut className="h-4 w-4" /> Verlassen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Kochbuch verlassen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Das Kochbuch verschwindet aus deiner Übersicht. Beim Ersteller bleibt es unverändert bestehen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => leaveMut.mutate()}>Verlassen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {isOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive">
                  <Trash2 className="h-4 w-4" /> Löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Kochbuch löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Die Rezepte selbst bleiben erhalten.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMut.mutate()}>Löschen</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Rezepte</h2>
        {isOwner && (
          <Button size="sm" onClick={() => setPickerOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Hinzufügen
          </Button>
        )}
      </div>

      {recipes.length === 0 ? (
        <EmptyState
          title="Noch keine Rezepte"
          description={
            isOwner
              ? "Füge deine ersten Rezepte zu diesem Kochbuch hinzu."
              : "Dieses geteilte Kochbuch ist noch leer."
          }
          action={
            isOwner ? (
              <Button onClick={() => setPickerOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Rezepte hinzufügen
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {recipes.map((r) => (
            <div key={r.id} className="relative">
              <RecipeCard recipe={r} />
              {isOwner && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      aria-label="Aus Kochbuch entfernen"
                      className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur transition-colors hover:bg-black/40"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Rezept aus Kochbuch entfernen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        „{r.title}“ wird aus diesem Kochbuch entfernt. Das Rezept selbst bleibt
                        erhalten.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeMut.mutate(r.id)}>
                        Entfernen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>
      )}

      <RecipePickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={recipes.map((r) => r.id)}
        onConfirm={(ids) => addMut.mutateAsync(ids)}
        submitting={addMut.isPending}
      />

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kochbuch teilen</DialogTitle>
            <DialogDescription>
              Jeder mit diesem Link kann das Kochbuch und seine Rezepte ansehen.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={copyShare} variant="outline" className="gap-1.5">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Kopiert" : "Kopieren"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isOwner && (
        <ShareCookbookWithFriendsDialog
          open={friendShareOpen}
          onOpenChange={setFriendShareOpen}
          cookbookId={id}
          cookbookTitle={cookbook.title}
        />
      )}
    </div>
  );
}
