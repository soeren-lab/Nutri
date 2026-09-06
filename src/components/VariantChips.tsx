import type { RecipeComponentWithRelations } from "@/types/recipe";
import { selectedVariantId, sortedVariants } from "@/lib/variants";
import { cn } from "@/lib/utils";

/** Auswahl der Variante einer 'choice'-Komponente (Chips). */
export function VariantChips({
  component,
  selectedId,
  onSelect,
  className,
}: {
  component: RecipeComponentWithRelations;
  selectedId?: string | null;
  onSelect: (variantId: string) => void;
  className?: string;
}) {
  const variants = sortedVariants(component);
  if (variants.length === 0) return null;
  const active = selectedId ?? selectedVariantId(component, null);

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {variants.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onSelect(v.id)}
          aria-pressed={active === v.id}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            active === v.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
