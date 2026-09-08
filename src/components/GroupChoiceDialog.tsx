import { useMemo, useState } from "react";
import { AlertTriangle, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FlexibleIngredientPicker } from "@/components/FlexibleIngredientPicker";
import { useIngredientsMaster } from "@/hooks/use-ingredients-master";
import { useSwipePriority } from "@/hooks/use-swipe-priority";
import {
  lastGroupChoice,
  mastersInGroup,
  type GroupChoices,
  type PendingGroup,
} from "@/lib/productGroups";

/**
 * Fragt für alle Produktgruppen-Zutaten die konkrete Sorte ab
 * (Kochmodus & Einplanen).
 */
export function GroupChoiceDialog({
  title,
  pending,
  onClose,
  onConfirm,
  confirmLabel = "Weiter",
  initial,
}: {
  title: string;
  pending: PendingGroup[];
  onClose: () => void;
  onConfirm: (choices: GroupChoices) => void;
  confirmLabel?: string;
  /** Bereits gewählte Sorten (nachträgliches Ändern). */
  initial?: GroupChoices | null;
}) {
  const list = useIngredientsMaster();
  const [choices, setChoices] = useState<GroupChoices>(() => {
    const out: GroupChoices = {};
    for (const p of pending) {
      const group = p.ingredient.product_group ?? "";
      const existing = initial?.[p.ingredient.id];
      const last = existing ?? lastGroupChoice(group);
      if (last && mastersInGroup(list, group).some((m) => m.id === last)) {
        out[p.ingredient.id] = last;
      }
    }
    return out;
  });

  const complete = useMemo(
    () => pending.every((p) => !!choices[p.ingredient.id]),
    [pending, choices],
  );

  useSwipePriority({ onSwipeLeft: onClose, onSwipeRight: onClose });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription>Sorte für die Produktgruppen wählen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {pending.map((p) => {
            const group = p.ingredient.product_group ?? "";
            const masters = mastersInGroup(list, group);
            return (
              <div key={p.ingredient.id} className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate">{group}</span>
                  {p.ingredient.amount != null && (
                    <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
                      {Number(p.ingredient.amount)} {p.ingredient.unit ?? ""}
                    </span>
                  )}
                </p>
                {p.componentName && (
                  <p className="text-xs text-muted-foreground">in {p.componentName}</p>
                )}
                <FlexibleIngredientPicker
                  group={group}
                  variant="button"
                  masters={masters}
                  value={choices[p.ingredient.id] ?? null}
                  onSelect={(m) => setChoices((c) => ({ ...c, [p.ingredient.id]: m.id }))}
                />
              </div>
            );
          })}
          {!complete && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              Sorte nicht gewählt – Nährwerte bleiben unvollständig.
            </p>
          )}
          <Button className="w-full" onClick={() => onConfirm(choices)}>
            {complete ? confirmLabel : `${confirmLabel} (ohne Sorte)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
