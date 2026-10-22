import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSheet } from "@/components/FormSheet";
import { IngredientThumb } from "@/components/IngredientThumb";
import { useAuth } from "@/hooks/use-auth";
import {
  FRIDGE_LOCATIONS,
  addDaysIso,
  addToFridge,
  deleteFridgeItem,
  formatAmount,
  lastAmountFor,
  rememberAdd,
  updateFridgeItem,
  type FridgeItem,
  type FridgeLocation,
} from "@/lib/fridge";
import { cn } from "@/lib/utils";

export type FridgeSheetMaster = {
  id: string;
  name: string;
  unit: string;
  image_url: string | null;
  category: string;
  brandName?: string | null;
};

const PANTRY_CATEGORIES = new Set([
  "Gewürze & Kräuter",
  "Getreide & Backwaren",
  "Öle & Fette",
  "Süßungsmittel",
  "Getränke",
  "Supplements",
]);

const EXPIRY_CHIPS = [
  { label: "Kein Datum", days: null },
  { label: "3 Tage", days: 3 },
  { label: "1 Woche", days: 7 },
  { label: "2 Wochen", days: 14 },
  { label: "1 Monat", days: 30 },
] as const;

/** Menge als Zahl lesen (Komma oder Punkt). */
function parseAmount(text: string): number | null {
  const n = Number(text.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Einlagern (neu) oder Bearbeiten (item gesetzt). Das Eingabefeld trägt die Menge in der Einheit der
 * Zutat (g, ml, Stück); `packHint` ist die Packungsgröße aus Open Food Facts und wird als Vorschlag
 * angeboten. Die zuletzt eingegebene Menge je Zutat wird gemerkt, damit ein zweiter Scan nur einen
 * Tipp braucht.
 */
export function FridgeItemSheet({
  open,
  onOpenChange,
  master,
  item,
  packHint,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  master: FridgeSheetMaster | null;
  item?: FridgeItem | null;
  packHint?: number | null;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amountText, setAmountText] = useState("");
  const [location, setLocation] = useState<FridgeLocation>("fridge");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !master) return;
    if (item) {
      setAmountText(String(item.amount));
      setLocation(item.location as FridgeLocation);
      setExpiresAt(item.expires_at ? item.expires_at.slice(0, 10) : null);
      return;
    }
    const remembered = lastAmountFor(master.id);
    const start = remembered ?? packHint ?? (master.unit === "Stück" ? 1 : null);
    setAmountText(start != null ? String(start) : "");
    setLocation(PANTRY_CATEGORIES.has(master.category) ? "pantry" : "fridge");
    setExpiresAt(null);
  }, [open, master, item, packHint]);

  const unit = master?.unit ?? "g";
  const amount = parseAmount(amountText);
  const step = unit === "Stück" ? 1 : 100;

  const chips: number[] = [];
  if (unit === "Stück") chips.push(1, 2, 3, 4, 6, 10);
  else {
    if (packHint) chips.push(packHint, packHint * 2);
    const last = master ? lastAmountFor(master.id) : null;
    if (last && !chips.includes(last)) chips.push(last);
    if (chips.length === 0) chips.push(250, 500, 1000);
  }

  function bump(delta: number) {
    const next = Math.max(0, (amount ?? 0) + delta);
    setAmountText(next === 0 ? "" : String(Math.round(next * 100) / 100));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!master || amount == null) throw new Error("Bitte eine Menge eingeben");
      if (item) {
        await updateFridgeItem(item.id, { amount, location, expires_at: expiresAt });
        return;
      }
      if (!user) throw new Error("Nicht angemeldet");
      await addToFridge({
        userId: user.id,
        masterId: master.id,
        amount,
        unit: master.unit,
        location,
        expiresAt,
      });
      rememberAdd(master.id, amount);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fridge"] });
      toast.success(item ? "Gespeichert" : `${master?.name ?? "Produkt"} eingelagert`);
      onOpenChange(false);
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteFridgeItem(item!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fridge"] });
      toast.success("Aufgebraucht, aus dem Kühlschrank entfernt");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!master) return null;

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Bestand bearbeiten" : "Einlagern"}
      footer={
        <div className="flex gap-2">
          {item && (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <Trash2 className="h-4 w-4" /> Aufgebraucht
            </Button>
          )}
          <Button
            type="button"
            className="flex-1"
            onClick={() => save.mutate()}
            disabled={amount == null || save.isPending}
          >
            {item ? "Speichern" : "Einlagern"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <IngredientThumb path={master.image_url} size="lg" />
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight">{master.name}</p>
            {master.brandName && (
              <p className="text-sm text-muted-foreground">{master.brandName}</p>
            )}
            {item && (
              <p className="text-xs text-muted-foreground">
                Aktuell {formatAmount(item.amount, item.unit)}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fridge-amount">Menge ({unit})</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Weniger"
              onClick={() => bump(-step)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              id="fridge-amount"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0"
              className="text-center text-lg font-semibold"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Mehr"
              onClick={() => bump(step)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAmountText(String(c))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  amount === c
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {formatAmount(c, unit)}
              </button>
            ))}
          </div>
          {packHint && !item && (
            <p className="text-xs text-muted-foreground">
              Packungsgröße laut Hersteller: {formatAmount(packHint, unit)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Wohin?</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {FRIDGE_LOCATIONS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLocation(l.id)}
                className={cn(
                  "rounded-xl border px-2 py-2 text-sm font-medium transition-colors",
                  location === l.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fridge-expiry">Haltbar bis (optional)</Label>
          <div className="flex flex-wrap gap-1.5">
            {EXPIRY_CHIPS.map((c) => {
              const value = c.days == null ? null : addDaysIso(c.days);
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setExpiresAt(value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    c.days == null && expiresAt == null
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <Input
            id="fridge-expiry"
            type="date"
            value={expiresAt ?? ""}
            onChange={(e) => setExpiresAt(e.target.value || null)}
          />
        </div>
      </div>
    </FormSheet>
  );
}
