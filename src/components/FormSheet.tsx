import type { ReactNode } from "react";
import { X } from "lucide-react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Sheet, SheetPortal, SheetOverlay } from "@/components/ui/sheet";
import {
  useBodyScrollLock,
  useVisualViewportHeight,
} from "@/hooks/use-sheet-viewport";
import { cn } from "@/lib/utils";

/**
 * Zentrale Sheet-Basis für Formulare (gleiche Grundlage wie SearchSheet):
 * - Höhe folgt dem visuellen Viewport → Tastatur verdeckt nichts
 * - eigener Scroll-Container für den Inhalt
 * - Body-Scroll-Lock
 * - optionaler Sticky-Footer (z. B. Speichern-Button)
 */
export function FormSheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const viewportStyle = useVisualViewportHeight(open);
  useBodyScrollLock(open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          className={cn(
            "fixed inset-x-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-background shadow-lg",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2! sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-border",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0",
            "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
            "data-[state=closed]:duration-300 data-[state=open]:duration-500",
            className,
          )}
          style={viewportStyle}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <SheetPrimitive.Title className="flex-1 truncate text-base font-semibold">
              {title}
            </SheetPrimitive.Title>
            <SheetPrimitive.Close
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Schließen"
            >
              <X className="h-5 w-5" />
            </SheetPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            {children}
          </div>

          {footer && (
            <div className="border-t border-border bg-background px-4 py-3">
              {footer}
            </div>
          )}
        </SheetPrimitive.Content>
      </SheetPortal>
    </Sheet>
  );
}
