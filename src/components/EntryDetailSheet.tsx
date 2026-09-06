import { Ban, Copy, CookingPot, ExternalLink, Link2, Unlink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { batchRoleOf, isBatched } from "@/lib/batch";
import {
  WEEKDAYS,
  entryAmountLabel,
  entryMacros,
  entryTitle,
  parseSnapshotIngredients,
  type MealPlanEntryFull,
} from "@/lib/meal-plan";

function formatWhen(entry: MealPlanEntryFull): string {
  const [y, m, d] = entry.date.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const dow = WEEKDAYS[(date.getDay() + 6) % 7];
  return `${entry.meal_slot}, ${dow} ${String(date.getDate()).padStart(2, "0")}.${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}.`;
}

const MACROS = [
  { key: "calories", label: "kcal" },
  { key: "protein_g", label: "Protein" },
  { key: "carbs_g", label: "KH" },
  { key: "fat_g", label: "Fett" },
  { key: "fiber_g", label: "Ballaststoffe" },
  { key: "sugar_g", label: "davon Zucker" },
] as const;

/**
 * Detailansicht eines geplanten Eintrags – zeigt bewusst den festgeschriebenen
 * Snapshot vom Zeitpunkt des Einplanens, nicht den aktuellen Rezept-Stand.
 */
export function EntryDetailSheet({
  entry,
  onClose,
  onEditServings,
  onEditAmount,
  onEditQuick,
  onEditGroups,
  onMove,
  onCopy,
  onRemove,
  onBatch,
  onDissolveBatch,
  onToggleSkipped,
  hasGroups,
}: {
  entry: MealPlanEntryFull;
  onClose: () => void;
  onEditServings: () => void;
  onEditAmount: () => void;
  onEditQuick: () => void;
  onEditGroups: () => void;
  onMove: () => void;
  onCopy: () => void;
  onRemove: () => void;
  onBatch: () => void;
  onDissolveBatch: () => void;
  onToggleSkipped: () => void;
  hasGroups: boolean;
}) {
  const macros = entryMacros(entry);
  const ingredients = parseSnapshotIngredients(entry.snapshot_ingredients);
  const amount = entryAmountLabel(entry);
  const batchRole = batchRoleOf(entry);
  const batched = isBatched(entry);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-sm overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="pr-6 text-base leading-snug">
            {entryTitle(entry)}
            <span className="block text-xs font-normal text-muted-foreground">
              {formatWhen(entry)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <p className="text-[11px] text-muted-foreground">
          Stand beim Einplanen – späteres Bearbeiten des Rezepts ändert diesen Eintrag nicht.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {entry.skipped && (
            <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Ban className="h-3 w-3" /> Ausgelassen
            </span>
          )}
          {amount && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs">{amount}</span>
          )}
          {entry.snapshot_variant_label && (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {entry.snapshot_variant_label}
            </span>
          )}
          {batchRole === "start" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
              <CookingPot className="h-3 w-3" /> Koch-Tag (Batch-Start)
            </span>
          )}
          {batchRole === "leftover" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
              <Link2 className="h-3 w-3" /> Vorgekocht / Rest
            </span>
          )}
        </div>

        {batchRole === "start" && (
          <p className="text-[11px] text-muted-foreground">
            An diesem Tag wird die volle Menge gekocht – der Einkauf enthält die Zutaten für alle
            verknüpften Tage.
          </p>
        )}
        {batchRole === "leftover" && (
          <p className="text-[11px] text-muted-foreground">
            Bereits vorgekocht – kein zusätzlicher Einkauf oder Kochaufwand. Die Nährwerte zählen
            trotzdem für diesen Tag.
          </p>
        )}

        {macros && (
          <div className="grid grid-cols-3 gap-2">
            {MACROS.map((m) => (
              <div key={m.key} className="rounded-xl bg-muted/50 p-2 text-center">
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
                <div className="text-sm font-semibold tabular-nums">
                  {Math.round((macros[m.key] ?? 0) * 10) / 10}
                </div>
              </div>
            ))}
          </div>
        )}

        {ingredients.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Zutaten (wie geplant)</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {ingredients.map((i, idx) => (
                <li key={`${i.name}-${idx}`} className="flex items-baseline gap-2 px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 text-xs">
                    {i.name}
                    {i.component && (
                      <span className="ml-1 text-[10px] text-muted-foreground">{i.component}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {i.amount != null && `${i.amount} ${i.unit ?? ""}`.trim()}
                    {i.calories != null && ` · ${Math.round(i.calories)} kcal`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          entry.food_type === "recipe" && (
            <p className="text-xs text-muted-foreground">
              Für diesen Eintrag wurde noch keine Zutatenliste gespeichert.
            </p>
          )
        )}

        {entry.food_type === "recipe" && entry.recipe_id && (
          <p className="text-xs text-muted-foreground">
            Zubereitung ist nicht Teil des Snapshots –{" "}
            <Link
              to="/recipes/$id"
              params={{ id: entry.recipe_id }}
              className="text-primary underline"
              onClick={onClose}
            >
              im aktuellen Rezept ansehen
            </Link>{" "}
            (aktueller Stand, kann von damals abweichen).
          </p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          {entry.food_type === "recipe" && (
            <Button variant="secondary" onClick={onEditServings}>
              Portionen anpassen
            </Button>
          )}
          {entry.food_type === "ingredient" && (
            <Button variant="secondary" onClick={onEditAmount}>
              Menge anpassen
            </Button>
          )}
          {entry.food_type === "quick_entry" && (
            <Button variant="secondary" onClick={onEditQuick}>
              Bearbeiten
            </Button>
          )}
          {entry.food_type === "recipe" && hasGroups && (
            <Button variant="secondary" onClick={onEditGroups}>
              Sorte ändern
            </Button>
          )}
          <Button variant="secondary" onClick={onMove}>
            Verschieben
          </Button>
          <Button variant="secondary" onClick={onCopy}>
            <Copy className="mr-2 h-4 w-4" /> Kopieren
          </Button>
          {entry.food_type === "recipe" && (
            <Button variant="secondary" onClick={onBatch}>
              <CookingPot className="mr-2 h-4 w-4" />{" "}
              {batched ? "Koch-Tag / Verknüpfung bearbeiten" : "Für mehrere Tage vorkochen"}
            </Button>
          )}
          {batched && (
            <Button variant="secondary" onClick={onDissolveBatch}>
              <Unlink className="mr-2 h-4 w-4" /> Batch-Verknüpfung lösen
            </Button>
          )}

          {entry.food_type === "recipe" && entry.recipe_id && (
            <Button variant="outline" asChild>
              <Link
                to="/recipes/$id"
                params={{ id: entry.recipe_id }}
                onClick={onClose}
                className="inline-flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" /> Zum Rezept (aktuelle Version)
              </Link>
            </Button>
          )}
          <Button variant="secondary" onClick={onToggleSkipped}>
            <Ban className="mr-2 h-4 w-4" />
            {entry.skipped ? "Doch gegessen" : "Ausgelassen"}
          </Button>
          <Button variant="destructive" onClick={onRemove}>
            Entfernen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
