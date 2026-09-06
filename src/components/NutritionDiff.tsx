import type { DiffField } from "@/lib/community";
import { ArrowRight } from "lucide-react";
import { IngredientThumb } from "@/components/IngredientThumb";

export function NutritionDiff({ fields }: { fields: DiffField[] }) {
  if (fields.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Keine inhaltlichen Änderungen.</p>
    );
  }
  return (
    <ul className="space-y-1">
      {fields.map((f) =>
        f.kind === "image" ? (
          <li
            key={f.key}
            className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs"
          >
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {f.label}
            </span>
            <IngredientThumb path={f.before || null} className="opacity-60" />
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            <IngredientThumb
              path={f.after || null}
              className="border-primary"
            />
          </li>
        ) : (
          <li
            key={f.key}
            className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs"
          >
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {f.label}
            </span>
            <span className="text-muted-foreground line-through">{f.before}</span>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="font-semibold text-primary">{f.after}</span>
          </li>
        ),
      )}
    </ul>
  );
}
