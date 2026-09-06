import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface NutritionValue {
  calories: number | "";
  protein_g: number | "";
  carbs_g: number | "";
  fat_g: number | "";
  fiber_g: number | "";
  sugar_g: number | "";
}

export const EMPTY_NUTRITION: NutritionValue = {
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  fiber_g: "",
  sugar_g: "",
};

type Field = keyof NutritionValue;

const FIELDS: Array<{ key: Field; label: string; short: string }> = [
  { key: "calories", label: "kcal", short: "kcal" },
  { key: "protein_g", label: "Protein (g)", short: "P" },
  { key: "carbs_g", label: "Kohlenhydrate (g)", short: "KH" },
  { key: "fat_g", label: "Fett (g)", short: "F" },
  { key: "fiber_g", label: "Ballaststoffe (g)", short: "BS" },
  { key: "sugar_g", label: "davon Zucker (g)", short: "Zucker" },
];

export function NutritionInput({
  value,
  onChange,
  idPrefix,
  showLabels = true,
  compact = false,
  ariaPrefix,
}: {
  value: NutritionValue;
  onChange: (v: NutritionValue) => void;
  idPrefix?: string;
  showLabels?: boolean;
  compact?: boolean;
  ariaPrefix?: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          {showLabels && (
            <Label htmlFor={idPrefix ? `${idPrefix}-${f.key}` : undefined} className="text-xs">
              {compact ? f.short : f.label}
            </Label>
          )}
          <Input
            id={idPrefix ? `${idPrefix}-${f.key}` : undefined}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder={compact ? f.short : ""}
            aria-label={ariaPrefix ? `${ariaPrefix} ${f.label}` : f.label}
            value={value[f.key]}
            onChange={(e) =>
              onChange({
                ...value,
                [f.key]: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            className={compact ? "h-9 text-sm" : ""}
          />
        </div>
      ))}
    </div>
  );
}
