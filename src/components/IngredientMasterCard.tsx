import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Trash2,
  MoreVertical,
  Flame,
  Globe,
  RefreshCw,
  EyeOff,
  Users,
  Plus,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { IngredientThumb } from "@/components/IngredientThumb";
import { MacroPills } from "@/components/MacroPills";
import { SharedWithBadge } from "@/components/SharedWithBadge";
import { ShareWithFriendsDialog } from "@/components/ShareWithFriendsDialog";

import { unarchiveIngredientMaster, type IngredientMaster } from "@/lib/ingredients-master";
import {
  findSimilarPublished,
  publishIngredient,
  unpublishIngredient,
} from "@/lib/community";
import { toast } from "sonner";

/** True, wenn eine veröffentlichte Zutat seit dem letzten Publish verändert wurde. */
export function hasUnpublishedChanges(m: IngredientMaster): boolean {
  if (!m.is_published || !m.published_at) return false;
  return new Date(m.updated_at).getTime() > new Date(m.published_at).getTime() + 1000;
}

/**
 * Einheitliche Zutaten-Card (Zutaten-Tab & Marken-Detailseite).
 * Enthält Badges (P/KH/F/BS/Z), Community-Tag und Drei-Punkte-Menü.
 */
export type CommunityCardInfo = {
  /** "du" oder "@username" */
  authorLabel: string;
  isOwn: boolean;
  added: boolean;
  adding: boolean;
  onAdd: () => void;
};

export function IngredientMasterCard({
  m,
  brandName,
  onEdit,
  onDelete,
  community,
}: {
  m: IngredientMaster;
  brandName: string | null;
  onEdit?: (m: IngredientMaster) => void;
  onDelete?: (m: IngredientMaster) => void;
  community?: CommunityCardInfo;
}) {

  const qc = useQueryClient();
  const [similarName, setSimilarName] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);


  function invalidate() {
    qc.invalidateQueries({ queryKey: ["ingredients_master"] });
    qc.invalidateQueries({ queryKey: ["community_ingredients"] });
    qc.invalidateQueries({ queryKey: ["brands"] });
  }

  const publishMut = useMutation({
    mutationFn: (id: string) => publishIngredient(id),
    onSuccess: (res) => {
      invalidate();
      setSimilarName(null);
      toast.success(`Veröffentlicht (Version ${res.published_version ?? 1})`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const unpublishMut = useMutation({
    mutationFn: (id: string) => unpublishIngredient(id),
    onSuccess: () => {
      invalidate();
      toast.success("Nicht mehr im Hub sichtbar");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const checkPublishMut = useMutation({
    mutationFn: async () => findSimilarPublished(m.name, m.id),
    onSuccess: (sim) => {
      if (sim?.name) setSimilarName(sim.name);
      else publishMut.mutate(m.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const unarchiveMut = useMutation({
    onMutate: () => {
      const previous = qc.getQueriesData<IngredientMaster[]>({ queryKey: ["ingredients_master"] });
      qc.setQueriesData({ queryKey: ["ingredients_master"] }, (old: IngredientMaster[] | undefined) =>
        (old ?? []).map((x) => (x.id === m.id ? { ...x, archived: false } : x)),
      );
      toast.success("Zutat wiederhergestellt");
      return { previous };
    },
    mutationFn: () => unarchiveIngredientMaster(m.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients_master"] });
    },
    onError: (e, _vars, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(e instanceof Error ? e.message : "Fehler");
    },
  });

  const unitLabel = m.unit === "Stk" ? "Stück" : m.unit;
  const per = unitLabel === "Stück" ? "/Stück" : "/100" + unitLabel;

  return (
    <li className="rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/30">
      <div className="flex items-start gap-3">
        <IngredientThumb path={m.image_url} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold leading-tight break-words">
                {m.name}
              </div>
              {(brandName || m.subcategory) && (
                <div className="mt-0.5 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                  {brandName ? (
                    <Link
                      to="/brands/$id"
                      params={{ id: m.brand_id! }}
                      className="truncate hover:text-foreground hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {brandName}
                    </Link>
                  ) : null}
                  {brandName && m.subcategory && <span>·</span>}
                  {m.subcategory && <span className="truncate">{m.subcategory}</span>}
                </div>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {(community || (m.is_published && !m.archived)) && (
                  <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Community
                  </span>
                )}
                {community && (
                  <span className="max-w-[9rem] truncate text-[11px] text-muted-foreground">
                    {community.authorLabel}
                  </span>
                )}
                {!community && m.source_ingredient_id && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Import
                  </span>
                )}
                {!community && m.archived && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Archiviert
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 pl-1">
              {community ? (

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      aria-label="Aktionen"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!community.isOwn && (
                      <DropdownMenuItem
                        onClick={() => community.onAdd()}
                        disabled={community.added || community.adding}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {community.added ? "Bereits hinzugefügt" : "Zu meinen Zutaten"}
                      </DropdownMenuItem>
                    )}
                    {community.isOwn && onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(m)}>
                        <Pencil className="mr-2 h-4 w-4" /> Bearbeiten
                      </DropdownMenuItem>
                    )}
                    {community.isOwn && onDelete && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(m)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Löschen
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : m.archived ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => unarchiveMut.mutate()}
                    disabled={unarchiveMut.isPending}
                  >
                    Wiederherstellen
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => onDelete?.(m)}
                    aria-label="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      aria-label="Aktionen"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!m.is_published && (
                      <DropdownMenuItem
                        onClick={() => checkPublishMut.mutate()}
                        disabled={checkPublishMut.isPending || publishMut.isPending}
                      >
                        <Globe className="mr-2 h-4 w-4" /> Veröffentlichen
                      </DropdownMenuItem>
                    )}
                    {m.is_published && hasUnpublishedChanges(m) && (
                      <DropdownMenuItem
                        onClick={() => publishMut.mutate(m.id)}
                        disabled={publishMut.isPending}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" /> Änderungen veröffentlichen
                      </DropdownMenuItem>
                    )}
                    {m.is_published && (
                      <DropdownMenuItem
                        onClick={() => unpublishMut.mutate(m.id)}
                        disabled={unpublishMut.isPending}
                      >
                        <EyeOff className="mr-2 h-4 w-4" /> Veröffentlichung zurückziehen
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShareOpen(true)}>
                      <Users className="mr-2 h-4 w-4" /> Mit Freund teilen
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />

                    {onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(m)}>
                        <Pencil className="mr-2 h-4 w-4" /> Bearbeiten
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(m)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Löschen
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

          </div>

          <div className="mt-2">
            <span className="flex items-center gap-1 text-[15px] font-semibold tabular-nums">
              <Flame className="h-4 w-4 text-primary" />
              {m.calories ?? "–"}
              <span className="text-xs font-medium text-muted-foreground">
                kcal {per.replace("/", "je ")}
              </span>
            </span>
          </div>
        </div>
      </div>

      {m.source === "openfoodfacts" && (
        <p className="mt-2 text-[11px] text-muted-foreground/70">
          Quelle: Open Food Facts
        </p>
      )}

      <MacroPills
        className="mt-2 w-full"
        protein_g={m.protein_g}
        carbs_g={m.carbs_g}
        fat_g={m.fat_g}
        fiber_g={m.fiber_g ?? 0}
        sugar_g={m.sugar_g ?? 0}
      />

      <SharedWithBadge contentType="ingredient" contentId={m.id} className="mt-2" />

      <ShareWithFriendsDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        contentType="ingredient"
        contentId={m.id}
        contentName={m.name}
      />




      <AlertDialog
        open={similarName !== null}
        onOpenChange={(o) => !o && setSimilarName(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ähnliche Zutat gefunden</AlertDialogTitle>
            <AlertDialogDescription>
              Ähnliche Zutat „{similarName}" existiert bereits im Hub. Trotzdem
              veröffentlichen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => publishMut.mutate(m.id)}>
              Trotzdem veröffentlichen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
