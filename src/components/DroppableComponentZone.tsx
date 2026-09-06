import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

/**
 * Drop-Ziel für Zutaten – entweder eine Komponente (`comp:<uid>`)
 * oder der Bereich „Ohne Komponente" (`free`).
 */
export function DroppableComponentZone({
  id,
  className,
  activeClassName = "border-primary bg-primary/5",
  children,
}: {
  id: string;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver, active } = useDroppable({ id });
  const highlight = isOver && !!active;

  return (
    <div
      ref={setNodeRef}
      data-drop-active={highlight ? "true" : undefined}
      className={cn(
        "transition-colors",
        className,
        highlight && activeClassName,
      )}
    >
      {children}
    </div>
  );
}
