import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  activeFilterCount,
  NUTRIENT_FIELDS,
  NUTRIENT_LABELS,
  NUTRIENT_UNITS,
  type NutrientFilters,
  type NutrientField,
} from "@/lib/ingredient-filters";

function toInput(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

/** Filter-Bottom-Sheet mit Min/Max-Feldern pro Nährwert. */
export function IngredientFilterSheet({
  filters,
  onApply,
}: {
  filters: NutrientFilters;
  onApply: (f: NutrientFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<NutrientFilters>(filters);
  const count = activeFilterCount(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  function setValue(field: NutrientField, key: "min" | "max", raw: string) {
    const num = raw === "" ? null : Number(raw);
    setDraft((d) => ({
      ...d,
      [field]: {
        min: key === "min" ? num : d[field]?.min ?? null,
        max: key === "max" ? num : d[field]?.max ?? null,
      },
    }));
  }

  return (
    <>
      <button
        type="button"
        aria-label="Nährwert-Filter"
        onClick={() => setOpen(true)}
        className="relative flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">Filter</span>
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-primary-foreground [background:var(--primary-gradient)]">
            {count}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nach Nährwerten filtern</SheetTitle>
          </SheetHeader>
          <p className="mt-1 text-xs text-muted-foreground">
            Werte beziehen sich auf die gespeicherte Bezugsmenge (100 g/ml bzw. 1 Stück).
          </p>
          <div className="mt-4 space-y-3">
            {NUTRIENT_FIELDS.map((field) => (
              <div key={field} className="space-y-1.5">
                <Label className="text-xs">
                  {NUTRIENT_LABELS[field]} ({NUTRIENT_UNITS[field]})
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="min."
                    aria-label={`${NUTRIENT_LABELS[field]} Minimum`}
                    value={toInput(draft[field]?.min)}
                    onChange={(e) => setValue(field, "min", e.target.value)}
                    className="h-9 text-sm"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="max."
                    aria-label={`${NUTRIENT_LABELS[field]} Maximum`}
                    value={toInput(draft[field]?.max)}
                    onChange={(e) => setValue(field, "max", e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
          <SheetFooter className="mt-4 flex-row gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setDraft({});
                onApply({});
                setOpen(false);
              }}
            >
              Zurücksetzen
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              Anwenden
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
