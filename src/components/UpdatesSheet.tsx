import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NutritionDiff } from "@/components/NutritionDiff";
import { IngredientThumb } from "@/components/IngredientThumb";
import {
  applyIngredientUpdate,
  diffIngredient,
  dismissIngredientUpdate,
  ingredientUpdatesQuery,
  type IngredientUpdate,
} from "@/lib/community";
import {
  applyRecipeUpdate,
  diffRecipe,
  dismissRecipeUpdate,
  recipeUpdatesQuery,
  type RecipeUpdate,
} from "@/lib/community-recipes";
import {
  acceptFriendRequest,
  acceptedNotificationsQuery,
  declineFriendRequest,
  incomingRequestsQuery,
  markAcceptedSeen,
} from "@/lib/friends";
import { UserAvatar } from "@/components/UserAvatar";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSwipePriority } from "@/hooks/use-swipe-priority";

export function UpdatesSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: updates = [], isLoading } = useQuery({
    ...ingredientUpdatesQuery(),
    enabled: open,
  });
  const { data: recipeUpdates = [], isLoading: loadingRecipes } = useQuery({
    ...recipeUpdatesQuery(),
    enabled: open,
  });

  const { data: friendRequests = [] } = useQuery({
    ...incomingRequestsQuery(),
    enabled: open,
  });
  const { data: acceptedNotes = [] } = useQuery({
    ...acceptedNotificationsQuery(),
    enabled: open,
  });

  function invalidateFriends() {
    qc.invalidateQueries({ queryKey: ["friends"] });
  }

  const acceptFriendMut = useMutation({
    mutationFn: (id: string) => acceptFriendRequest(id),
    onSuccess: () => {
      invalidateFriends();
      toast.success("Freundschaft bestätigt");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const declineFriendMut = useMutation({
    mutationFn: (id: string) => declineFriendRequest(id),
    onSuccess: () => {
      invalidateFriends();
      toast.success("Anfrage abgelehnt");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const seenMut = useMutation({
    mutationFn: (id: string) => markAcceptedSeen(id),
    onSuccess: invalidateFriends,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["ingredient_updates"] });
    qc.invalidateQueries({ queryKey: ["ingredients_master"] });
    qc.invalidateQueries({ queryKey: ["recipe_updates"] });
    qc.invalidateQueries({ queryKey: ["recipes"] });
  }

  const applyMut = useMutation({
    mutationFn: (u: IngredientUpdate) => applyIngredientUpdate(u),
    onSuccess: () => {
      invalidate();
      toast.success("Update übernommen");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const applyAllMut = useMutation({
    mutationFn: async () => {
      for (const u of updates) await applyIngredientUpdate(u);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Alle Updates übernommen");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const dismissMut = useMutation({
    mutationFn: (u: IngredientUpdate) => dismissIngredientUpdate(u),
    onSuccess: () => {
      invalidate();
      toast.success("Update ignoriert");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const applyRecipeMut = useMutation({
    mutationFn: (u: RecipeUpdate) => applyRecipeUpdate(u),
    onSuccess: () => {
      invalidate();
      toast.success("Rezept aktualisiert");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const dismissRecipeMut = useMutation({
    mutationFn: (u: RecipeUpdate) => dismissRecipeUpdate(u),
    onSuccess: () => {
      invalidate();
      toast.success("Update ignoriert");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const busy =
    applyMut.isPending ||
    applyAllMut.isPending ||
    dismissMut.isPending ||
    applyRecipeMut.isPending ||
    dismissRecipeMut.isPending;

  const total =
    updates.length + recipeUpdates.length + friendRequests.length + acceptedNotes.length;

  useSwipePriority(
    open
      ? { onSwipeLeft: () => onOpenChange(false), onSwipeRight: () => onOpenChange(false) }
      : null,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4 text-left">
          <SheetTitle>Benachrichtigungen</SheetTitle>
          <SheetDescription>
            Freundschaftsanfragen und aktualisierte Werte für deine importierten Zutaten und
            Rezepte.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          {isLoading || loadingRecipes ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : total === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Keine neuen Benachrichtigungen.
            </p>
          ) : (
            <>
              {friendRequests.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold">
                    Freundschaftsanfragen ({friendRequests.length})
                  </div>
                  {friendRequests.map((r) => (
                    <div
                      key={r.requestId}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                    >
                      <UserAvatar label={r.username} avatarUrl={r.avatarUrl} className="h-9 w-9" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">@{r.username}</div>
                        <div className="text-xs text-muted-foreground">
                          möchte mit dir befreundet sein
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={acceptFriendMut.isPending}
                        onClick={() => acceptFriendMut.mutate(r.requestId)}
                      >
                        <Check className="h-4 w-4" /> Annehmen
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        disabled={declineFriendMut.isPending}
                        onClick={() => declineFriendMut.mutate(r.requestId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full" asChild>
                    <Link
                      to="/profile"
                      search={{ tab: "friends" }}
                      onClick={() => onOpenChange(false)}
                    >
                      Zum Freunde-Bereich
                    </Link>
                  </Button>
                </div>
              )}

              {acceptedNotes.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold">
                    Neue Freundschaften ({acceptedNotes.length})
                  </div>
                  {acceptedNotes.map((n) => (
                    <div
                      key={n.requestId}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                    >
                      <UserAvatar label={n.username} avatarUrl={n.avatarUrl} className="h-9 w-9" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">@{n.username}</div>
                        <div className="text-xs text-muted-foreground">
                          hat deine Anfrage angenommen
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={seenMut.isPending}
                        onClick={() => seenMut.mutate(n.requestId)}
                      >
                        Alles klar
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {updates.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold">Zutaten ({updates.length})</div>
                  <Button className="w-full" onClick={() => applyAllMut.mutate()} disabled={busy}>
                    {applyAllMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Alle übernehmen ({updates.length})
                  </Button>

                  {updates.map((u) => (
                    <div
                      key={u.copy.id}
                      className="space-y-3 rounded-2xl border border-border bg-card p-3"
                    >
                      <div className="flex items-center gap-3">
                        <IngredientThumb path={u.copy.image_url} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{u.copy.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.kind === "shared"
                              ? "Geteiltes Original wurde geändert"
                              : `v${u.copy.imported_version ?? 0} → v${u.source.published_version}`}
                          </div>
                        </div>
                      </div>

                      <NutritionDiff fields={diffIngredient(u.copy, u.source)} />

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5"
                          disabled={busy}
                          onClick={() => applyMut.mutate(u)}
                        >
                          <Check className="h-4 w-4" /> Übernehmen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1.5"
                          disabled={busy}
                          onClick={() => dismissMut.mutate(u)}
                        >
                          <X className="h-4 w-4" /> Ignorieren
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {recipeUpdates.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold">Rezepte ({recipeUpdates.length})</div>
                  {recipeUpdates.map((u) => (
                    <div
                      key={u.copy.id}
                      className="space-y-3 rounded-2xl border border-border bg-card p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{u.copy.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.kind === "shared"
                            ? "Geteiltes Original wurde geändert"
                            : `v${u.copy.imported_version ?? 0} → v${u.source.published_version}`}
                        </div>
                      </div>

                      <NutritionDiff fields={diffRecipe(u.copy, u.source)} />
                      <p className="text-xs text-muted-foreground">
                        Beim Übernehmen werden Zutaten, Komponenten und Schritte deiner Kopie durch
                        die neue Version ersetzt.
                      </p>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5"
                          disabled={busy}
                          onClick={() => applyRecipeMut.mutate(u)}
                        >
                          <Check className="h-4 w-4" /> Übernehmen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1.5"
                          disabled={busy}
                          onClick={() => dismissRecipeMut.mutate(u)}
                        >
                          <X className="h-4 w-4" /> Ignorieren
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
