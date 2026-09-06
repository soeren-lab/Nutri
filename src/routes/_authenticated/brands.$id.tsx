import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EmptyState } from "@/components/EmptyState";
import { IngredientMasterFormDialog } from "@/components/IngredientMasterFormDialog";
import { IngredientMasterCard } from "@/components/IngredientMasterCard";
import { IngredientDeleteDialog } from "@/components/IngredientDeleteDialog";
import {
  brandsQuery,
  updateBrand,
  deleteBrand,
  countBrandUsage,
} from "@/lib/brands";
import {
  ingredientsMasterQuery,
  type IngredientMaster,
} from "@/lib/ingredients-master";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/brands/$id")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(brandsQuery());
    context.queryClient.ensureQueryData(ingredientsMasterQuery());
  },
  component: BrandDetailPage,
  pendingComponent: () => (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  ),
});

function BrandDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: brands } = useSuspenseQuery(brandsQuery());
  const { data: ingredients } = useSuspenseQuery(ingredientsMasterQuery());

  const brand = useMemo(() => brands.find((b) => b.id === id), [brands, id]);
  const items = useMemo(
    () => ingredients.filter((m) => m.brand_id === id),
    [ingredients, id],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [ingDialogOpen, setIngDialogOpen] = useState(false);
  const [ingEditing, setIngEditing] = useState<IngredientMaster | undefined>();
  const [ingDeleteTarget, setIngDeleteTarget] = useState<IngredientMaster | null>(null);
  const [ingDeleteOpen, setIngDeleteOpen] = useState(false);

  const saveMut = useMutation({
    mutationFn: () => updateBrand(id, editName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["ingredients_master"] });
      toast.success("Marke aktualisiert");
      setEditOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const usage = await countBrandUsage(id);
      if (usage > 0) {
        throw new Error(
          `Marke wird noch bei ${usage} Zutat${usage === 1 ? "" : "en"} verwendet. Bitte zuerst dort entfernen.`,
        );
      }
      return deleteBrand(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["ingredients_master"] });
      toast.success("Marke gelöscht");
      navigate({ to: "/ingredients" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  if (!brand) {
    return (
      <div className="space-y-4">
        <Link to="/ingredients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
        <EmptyState title="Marke nicht gefunden" description="Diese Marke existiert nicht oder wurde gelöscht." />
      </div>
    );
  }

  function openIngredient(m: IngredientMaster) {
    setIngEditing(m);
    setIngDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/ingredients"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Zurück zu Zutaten
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{brand.name}</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} Zutat{items.length === 1 ? "" : "en"} mit dieser Marke
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditName(brand.name);
              setEditOpen(true);
            }}
            className="gap-1.5"
          >
            <Pencil className="h-4 w-4" /> Bearbeiten
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Trash2 className="h-4 w-4" /> Löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Marke löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  „{brand.name}" wird entfernt. Löschen ist nur möglich, wenn keine
                  Zutat mehr diese Marke verwendet.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMut.mutate()}
                  disabled={deleteMut.isPending}
                >
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Noch keine Zutaten dieser Marke"
          description="Ordne einer Zutat diese Marke zu, um sie hier zu sehen."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((m) => (
            <IngredientMasterCard
              key={m.id}
              m={m}
              brandName={brand.name}
              onEdit={openIngredient}
              onDelete={(x) => {
                setIngDeleteTarget(x);
                setIngDeleteOpen(true);
              }}
            />
          ))}
        </ul>
      )}


      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marke bearbeiten</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMut.mutate();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="brand-edit-name">Name *</Label>
              <Input
                id="brand-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                maxLength={120}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending ? "Speichern…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <IngredientMasterFormDialog
        open={ingDialogOpen}
        onOpenChange={setIngDialogOpen}
        existing={ingEditing}
      />
      <IngredientDeleteDialog
        ingredient={ingDeleteTarget}
        open={ingDeleteOpen}
        onOpenChange={(o) => {
          setIngDeleteOpen(o);
          if (!o) setIngDeleteTarget(null);
        }}
      />
    </div>
  );
}
