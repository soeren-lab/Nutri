interface Totals {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
}

const CELLS: Array<{ label: string; key: keyof Totals; unit: string }> = [
  { label: "Kalorien", key: "calories", unit: "kcal" },
  { label: "Protein", key: "protein_g", unit: "g" },
  { label: "Kohlenhydrate", key: "carbs_g", unit: "g" },
  { label: "Fett", key: "fat_g", unit: "g" },
  { label: "Ballaststoffe", key: "fiber_g", unit: "g" },
  { label: "davon Zucker", key: "sugar_g", unit: "g" },
];

export function NutritionSummary({
  totals,
  caption,
}: {
  totals: Totals;
  caption?: string;
}) {
  return (
    <div>
      {caption && <div className="mb-2 text-xs text-muted-foreground">{caption}</div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        {CELLS.map((c) => (
          <div key={c.key} className="rounded-xl bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-lg font-semibold">
              {totals[c.key] != null ? (
                <>
                  {totals[c.key]}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {c.unit}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">–</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
