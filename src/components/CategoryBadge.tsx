import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/categories";
import { X } from "lucide-react";

export function CategoryBadge({
  name,
  className,
  onRemove,
}: {
  name: string;
  className?: string;
  onRemove?: () => void;
}) {
  const c = getCategoryColor(name);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        c.bg,
        c.text,
        c.border,
        className,
      )}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 -mr-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
          aria-label={`${name} entfernen`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
