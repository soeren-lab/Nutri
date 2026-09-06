import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Umhüllt eine Zutaten-Card mit Drag-Handle, damit sie zwischen
 * Komponenten und dem Bereich „Ohne Komponente" verschoben werden kann.
 */
export function DraggableIngredientRow({
  uid,
  fromComponentUid,
  children,
}: {
  uid: string;
  /** Quell-Komponente (null = freie Zutat). */
  fromComponentUid: string | null;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: uid,
    data: { fromComponentUid },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-start gap-1 transition-opacity",
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        aria-label="Zutat verschieben"
        className="mt-2.5 shrink-0 cursor-grab touch-none rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
