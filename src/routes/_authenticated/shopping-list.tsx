import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSheet } from "@/components/FormSheet";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { CategoryBadge } from "@/components/CategoryBadge";
import { IngredientThumb } from "@/components/IngredientThumb";
import { useAuth } from "@/hooks/use-auth";
import { groupByCategory } from "@/lib/categories";
import { recipesQuery } from "@/lib/recipes";
import {
  addManualItem,
  amountLabel,
  clearShoppingList,
  deleteShoppingItem,
  setItemChecked,
  shoppingListQuery,
  updateShoppingItem,
  SHOPPING_CATEGORY_ORDER,
  type ShoppingListItem,
} from "@/lib/shopping-list";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shopping-list")({
  head: () => ({
    meta: [
      { title: "Einkaufsliste – Rezeptbuch" },
      {
        name: "description",
        content:
          "Automatisch aus deinem Wochenplan erzeugte Einkaufsliste: nach Kategorien gruppiert, abhakbar und manuell erweiterbar.",
      },
      { property: "og:title", content: "Einkaufsliste – Rezeptbuch" },
      {
        property: "og:description",
        content: "Zutaten aus dem Planer aggregiert, nach Kategorien gruppiert und abhakbar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShoppingListPage,
});

function ShoppingListPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: items, isLoading } = useQuery(shoppingListQuery());
  const { data: recipes } = useQuery(recipesQuery());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [editItem, setEditItem] = useState<ShoppingListItem | null>(null);

  const recipeTitles = useMemo(() => {
    const map = new Map<string, string>();
    (recipes ?? []).forEach((r) => map.set(r.id, r.title));
    return map;
  }, [recipes]);

  const groups = useMemo(() => {
    const sorted = [...(items ?? [])].sort((a, b) => {
      if (a.is_checked !== b.is_checked) return a.is_checked ? 1 : -1;
      return a.name.localeCompare(b.name, "de");
    });
    return groupByCategory(sorted, (i) => i.category, SHOPPING_CATEGORY_ORDER);
  }, [items]);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["shopping-list"] });
  }

  const toggle = useMutation({
    mutationFn: (v: { id: string; checked: boolean }) => setItemChecked(v.id, v.checked),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteShoppingItem(id),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: () => clearShoppingList(user!.id),
    onSuccess: () => {
      invalidate();
      toast.success("Liste geleert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCount = (items ?? []).filter((i) => !i.is_checked).length;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Einkaufsliste</h1>
          <p className="text-xs text-muted-foreground">
            {openCount > 0 ? `${openCount} offene Artikel` : "Alles erledigt"}
          </p>
        </div>
        {(items ?? []).length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setClearOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Leeren
          </Button>
        )}
      </header>

      {(items ?? []).length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-6 w-6" />}
          title="Noch keine Artikel"
          description="Erstelle im Planer eine Liste aus deinen geplanten Mahlzeiten oder füge Artikel manuell hinzu."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Artikel hinzufügen
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isCollapsed = collapsed[g.category] ?? false;
            const open = g.items.filter((i) => !i.is_checked).length;
            return (
              <div
                key={g.category}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [g.category]: !isCollapsed }))
                  }
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <span className="flex items-center gap-2">
                    <CategoryBadge name={g.category} />
                    <span className="text-xs text-muted-foreground">
                      {open}/{g.items.length}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                </button>
                {!isCollapsed && (
                  <ul className="divide-y divide-border border-t border-border">
                    {g.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        recipeTitles={recipeTitles}
                        onEdit={() => setEditItem(item)}
                        onToggle={(checked) => toggle.mutate({ id: item.id, checked })}
                        onDelete={() => remove.mutate(item.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          <Button variant="outline" className="w-full" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Artikel hinzufügen
          </Button>
        </div>
      )}

      <ItemSheet open={addOpen} onOpenChange={setAddOpen} onSaved={invalidate} />
      <ItemSheet
        key={editItem?.id ?? "new"}
        item={editItem}
        open={editItem !== null}
        onOpenChange={(o) => !o && setEditItem(null)}
        onSaved={invalidate}
      />

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liste leeren?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Artikel werden entfernt. Das kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => clear.mutate()}>Leeren</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ItemRow({
  item,
  recipeTitles,
  onToggle,
  onDelete,
  onEdit,
}: {
  item: ShoppingListItem;
  recipeTitles: Map<string, string>;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const sources = item.source_recipe_ids ?? [];
  const names = sources.map((id) => recipeTitles.get(id) ?? "Unbekanntes Rezept");
  const label = amountLabel(item);

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Checkbox
        checked={item.is_checked}
        onCheckedChange={(v) => onToggle(v === true)}
        aria-label={`${item.name} abhaken`}
      />
      {item.master_image_url && <IngredientThumb path={item.master_image_url} size="sm" />}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-semibold",
            item.is_checked && "text-muted-foreground line-through",
          )}
        >
          {item.name}
          {item.brand_name && (
            <span className="font-normal text-muted-foreground"> · {item.brand_name}</span>
          )}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
          {names.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground"
                >
                  {names.length === 1 ? `aus ${names[0]}` : `aus ${names.length} Rezepten`}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-60 text-xs">
                <p className="mb-1 font-semibold">Beitragende Rezepte</p>
                <ul className="space-y-1 text-muted-foreground">
                  {names.map((n, i) => (
                    <li key={`${n}-${i}`}>• {n}</li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}
          {item.is_manual && (
            <span className="text-[11px] text-muted-foreground">manuell</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={`${item.name} bearbeiten`}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={`${item.name} entfernen`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function ItemSheet({
  open,
  onOpenChange,
  onSaved,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  item?: ShoppingListItem | null;
}) {
  const { user } = useAuth();
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const [amount, setAmount] = useState(item?.amount != null ? String(item.amount) : "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [category, setCategory] = useState<string>(item?.category ?? "Sonstiges");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    const parsedAmount = amount.trim() === "" ? null : Number(amount.replace(",", "."));
    if (parsedAmount != null && Number.isNaN(parsedAmount)) {
      toast.error("Ungültige Menge");
      return;
    }
    setBusy(true);
    try {
      if (item) {
        await updateShoppingItem(item.id, {
          name: name.trim(),
          amount: parsedAmount,
          unit: unit.trim() === "" ? null : unit.trim(),
          category,
        });
        toast.success("Gespeichert");
      } else {
        if (!user) return;
        await addManualItem({
          userId: user.id,
          name: name.trim(),
          amount: parsedAmount,
          unit: unit.trim() === "" ? null : unit.trim(),
        });
        setName("");
        setAmount("");
        setUnit("");
        toast.success("Hinzugefügt");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Artikel bearbeiten" : "Artikel hinzufügen"}
      footer={
        <Button
          className="w-full"
          onClick={() => void save()}
          disabled={busy || name.trim() === ""}
        >
          {isEdit ? "Speichern" : "Hinzufügen"}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="item-name">Name</Label>
          <Input
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Spülmittel"
            autoComplete="off"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="item-amount">Menge (optional)</Label>
            <Input
              id="item-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-unit">Einheit (optional)</Label>
            <Input
              id="item-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="g, ml, Stück"
            />
          </div>
        </div>
        {isEdit && (
          <div className="space-y-1">
            <Label>Kategorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHOPPING_CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </FormSheet>

  );
}
