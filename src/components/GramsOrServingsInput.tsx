import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PortionSummary } from "@/hooks/use-portion-summary";
import { cn } from "@/lib/utils";

export type PortionInputMode = "servings" | "grams";

export type PortionInputValue = {
  mode: PortionInputMode;
  /** Portionen im Portionen-Modus (ganze/halbe Portionen). */
  servings: number;
  /** Rohtext der Gramm-Eingabe (leer erlaubt). */
  grams: string;
};

/** Errechneter Portionsfaktor der aktuellen Eingabe (null = ungültig). */
export function portionFactorOf(value: PortionInputValue, summary: PortionSummary): number | null {
  if (value.mode === "servings") return value.servings > 0 ? value.servings : null;
  const g = Number(value.grams.replace(",", "."));
  if (!Number.isFinite(g) || g <= 0) return null;
  return summary.gramsToServings(g);
}

/** Gramm-Wert der aktuellen Eingabe (nur im Gramm-Modus). */
export function gramsValueOf(value: PortionInputValue): number | null {
  if (value.mode !== "grams") return null;
  const g = Number(value.grams.replace(",", "."));
  return Number.isFinite(g) && g > 0 ? g : null;
}

/**
 * Mengen-Eingabe beim Einplanen: Portionen-Stepper oder direkte
 * Gramm-Eingabe mit Live-Vorschau der Nährwerte.
 */
export function GramsOrServingsInput({
  value,
  onChange,
  summary,
}: {
  value: PortionInputValue;
  onChange: (v: PortionInputValue) => void;
  summary: PortionSummary;
}) {
  const gramsAvailable = summary.gramsPerServing != null;
  const factor = portionFactorOf(value, summary);
  const preview = factor != null ? summary.macrosFor(factor) : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1">
        {(["servings", "grams"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={value.mode === m}
            disabled={m === "grams" && !gramsAvailable}
            onClick={() =>
              onChange({
                ...value,
                mode: m,
                grams:
                  m === "grams" && value.grams.length === 0
                    ? String(summary.servingsToGrams(value.servings) ?? "")
                    : value.grams,
              })
            }
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              value.mode === m
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              m === "grams" && !gramsAvailable && "opacity-40",
            )}
          >
            {m === "servings" ? "Portionen" : "Gramm"}
          </button>
        ))}
      </div>

      {value.mode === "servings" ? (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              onChange({
                ...value,
                servings: Math.max(0.5, Math.round((value.servings - 0.5) * 2) / 2),
              })
            }
            aria-label="Weniger Portionen"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-14 text-center text-xl font-bold tabular-nums">
            {value.servings % 1 === 0 ? value.servings : value.servings.toFixed(1)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              onChange({
                ...value,
                servings: Math.min(99, Math.round((value.servings + 0.5) * 2) / 2),
              })
            }
            aria-label="Mehr Portionen"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={value.grams}
            onChange={(e) => onChange({ ...value, grams: e.target.value })}
            aria-label="Gesamtgewicht in Gramm"
            placeholder="z.B. 350"
          />
          <span className="w-8 shrink-0 text-sm text-muted-foreground">g</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {gramsAvailable
          ? `1 Portion ≈ ${summary.gramsPerServing} g`
          : "Gewicht nicht ermittelbar (z.B. Stück-Einheiten)"}
        {value.mode === "grams" && factor != null && ` · entspricht ${factor.toFixed(2)} Portionen`}
      </p>

      {preview && (
        <div className="grid grid-cols-4 gap-2 rounded-xl border border-border p-2 text-center">
          {[
            { label: "kcal", v: preview.calories },
            { label: "P", v: preview.protein_g },
            { label: "KH", v: preview.carbs_g },
            { label: "F", v: preview.fat_g },
            { label: "BS", v: preview.fiber_g },
          ].map((x) => (
            <div key={x.label}>
              <p className="text-sm font-semibold tabular-nums">{Math.round(x.v)}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{x.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
