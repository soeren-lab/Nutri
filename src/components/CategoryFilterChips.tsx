import { getCategoryColor } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function CategoryFilterChips({
  categories,
  selected,
  onToggle,
  onClear,
  allLabel = "Alle",
  className,
  compact = false,
}: {
  categories: readonly string[];
  selected: string[];
  onToggle: (category: string) => void;
  onClear: () => void;
  allLabel?: string;
  className?: string;
  /** Schmalere, dezentere Chips (z.B. für den Community-Feed) */
  compact?: boolean;
}) {
  const base = compact
    ? "shrink-0 rounded-full border px-2 py-[1px] text-[11px] font-medium transition-colors"
    : "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors";
  return (
    <div
      className={cn(
        compact
          ? "-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex flex-wrap items-center gap-1.5",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClear}
        className={cn(
          base,
          selected.length === 0
            ? compact
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-primary bg-primary text-primary-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        {allLabel}
      </button>
      {categories.map((c) => {
        const color = getCategoryColor(c);
        const active = selected.includes(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => onToggle(c)}
            className={cn(
              base,
              active
                ? cn(color.bg, color.text, color.border)
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
