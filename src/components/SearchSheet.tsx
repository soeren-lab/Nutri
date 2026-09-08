import { useEffect, useState, type ReactNode } from "react";
import { X, Plus } from "lucide-react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Sheet, SheetPortal, SheetOverlay } from "@/components/ui/sheet";
import { SearchInputWithBeam } from "@/components/SearchInputWithBeam";
import { useBodyScrollLock, useVisualViewportHeight } from "@/hooks/use-sheet-viewport";
import { useSwipePriority } from "@/hooks/use-swipe-priority";
import { cn } from "@/lib/utils";

export type SearchSheetItem = { id: string };

type Props<T extends SearchSheetItem> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: T[];
  /** Which string(s) the search matches against. */
  getSearchText: (item: T) => string;
  renderItem: (
    item: T,
    ctx: { selected: boolean; onSelect: () => void; query: string },
  ) => ReactNode;
  /** Called when an item is picked (single-select mode). Sheet auto-closes. */
  onSelect?: (item: T) => void;
  /** Highlight the currently selected id in the list. */
  selectedId?: string | null;
  /** Selected ids for multi-select rendering (checkmark state). */
  selectedIds?: string[];
  /** Toggle handler for multi-select mode. */
  onToggle?: (item: T) => void;
  /** Hide the search input (short fixed lists). */
  hideSearch?: boolean;
  /** Optionaler Bereich direkt unter der Suchleiste (Sortierung/Filter/Chips). */
  toolbar?: ReactNode;
  placeholder?: string;
  /** Sticky footer, e.g. confirm/cancel buttons. */
  footer?: ReactNode;
  /** Empty state when there are no items at all. */
  emptyLabel?: string;
  /**
   * Quick-create hook. When a query is entered and no item's search text
   * matches it exactly (case-insensitive), an extra row is rendered at the
   * top of the list: `+ „{query}" erstellen`. Clicking it calls onCreate.
   */
  onCreate?: (query: string) => void | Promise<void>;
  /** Custom label for the quick-create row. */
  createLabel?: (query: string) => ReactNode;
  /** Extra actions rendered above the list when the query has no exact match. */
  renderQueryExtras?: (query: string) => ReactNode;
  /** Zusätzliche <li>-Einträge am Ende der Ergebnisliste (z. B. externe Quellen). */
  renderAfterList?: (query: string) => ReactNode;
  /** Zutaten-Suche: BorderBeam-Effekt am Suchfeld bei Fokus. */
};

export function SearchSheet<T extends SearchSheetItem>({
  open,
  onOpenChange,
  title,
  items,
  getSearchText,
  renderItem,
  onSelect,
  selectedId,
  selectedIds,
  onToggle,
  hideSearch,
  toolbar,
  placeholder = "Suchen…",
  footer,
  emptyLabel = "Keine Einträge",
  onCreate,
  createLabel,
  renderQueryExtras,
  renderAfterList,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const viewportStyle = useVisualViewportHeight(open);
  useBodyScrollLock(open);
  // Reine Auswahl-Liste, kein Formularzustand zu verlieren – Swipe schließt
  // direkt, ohne Rückfrage.
  useSwipePriority(
    open
      ? { onSwipeLeft: () => onOpenChange(false), onSwipeRight: () => onOpenChange(false) }
      : null,
  );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const trimmed = query.trim();
  const q = trimmed.toLowerCase();
  const filtered = q ? items.filter((i) => getSearchText(i).toLowerCase().includes(q)) : items;
  const hasExactMatch = !!q && items.some((i) => getSearchText(i).trim().toLowerCase() === q);
  const showCreateRow = !!onCreate && !!trimmed && !hasExactMatch;
  const showExtras = !!renderQueryExtras && !!trimmed && !hasExactMatch;

  async function handleCreate() {
    if (!onCreate || !trimmed) return;
    await onCreate(trimmed);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          // Bewusst am Viewport verankert (Portal an document.body), damit die
          // Position unabhängig vom auslösenden Button/Scroll-Container ist.
          className={cn(
            "fixed inset-x-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-background shadow-lg",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2! sm:h-[80vh] sm:max-h-[80vh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-border",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0",
            "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
            "data-[state=closed]:duration-300 data-[state=open]:duration-500",
          )}
          style={viewportStyle}
          // Kein Autofocus: sonst öffnet die Tastatur, bevor die Liste
          // gelayoutet ist – der Nutzer sieht einen leeren Bereich.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div
            className="flex items-center gap-2 border-b border-border px-4 py-3"
            style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
          >
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

          {!hideSearch && (
            <div className="border-b border-border px-4 py-3">
              <SearchInputWithBeam
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                // Mobile Browser scrollen das Input beim Fokus in den
                // sichtbaren Bereich – das verschiebt sonst den ganzen Screen.
                onFocus={() => {
                  requestAnimationFrame(() => {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && showCreateRow && filtered.length === 0) {
                    e.preventDefault();
                    void handleCreate();
                  }
                }}
              />
            </div>
          )}

          {toolbar && <div className="border-b border-border px-4 py-2.5">{toolbar}</div>}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
            {filtered.length === 0 && !showCreateRow && !showExtras && !renderAfterList ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                {items.length === 0
                  ? emptyLabel
                  : q
                    ? `Keine Ergebnisse für „${query.trim()}"`
                    : emptyLabel}
              </div>
            ) : (
              <ul className="space-y-1">
                {showCreateRow && (
                  <li>
                    <SearchSheetRow onClick={handleCreate}>
                      <Plus className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1 truncate text-primary">
                        {createLabel ? createLabel(trimmed) : <>„{trimmed}" erstellen</>}
                      </span>
                    </SearchSheetRow>
                  </li>
                )}
                {showExtras && <li>{renderQueryExtras!(trimmed)}</li>}
                {filtered.length === 0 && !showCreateRow && !showExtras && (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {items.length === 0
                      ? emptyLabel
                      : q
                        ? `Keine Ergebnisse für „${query.trim()}"`
                        : emptyLabel}
                  </li>
                )}
                {filtered.map((item) => {
                  const isSelected = selectedIds
                    ? selectedIds.includes(item.id)
                    : selectedId === item.id;
                  return (
                    <li key={item.id}>
                      {renderItem(item, {
                        query: trimmed,
                        selected: isSelected,
                        onSelect: () => {
                          if (onToggle) {
                            onToggle(item);
                          } else if (onSelect) {
                            onSelect(item);
                            onOpenChange(false);
                          }
                        },
                      })}
                    </li>
                  );
                })}
                {/* Externe Quellen ergänzen die Liste nach den eigenen Treffern. */}
                {renderAfterList?.(trimmed)}
              </ul>
            )}
          </div>

          {footer && <div className="border-t border-border bg-background px-4 py-3">{footer}</div>}
        </SheetPrimitive.Content>
      </SheetPortal>
    </Sheet>
  );
}

/** Consistent row style for use inside renderItem. */
export function SearchSheetRow({
  onClick,
  selected,
  children,
  className,
}: {
  onClick: () => void;
  selected?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
        selected ? "border-primary bg-accent" : "border-transparent hover:bg-accent/60",
        className,
      )}
    >
      {children}
    </button>
  );
}
