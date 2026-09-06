import { cn } from "@/lib/utils";

export interface MacroPillsProps {
  protein_g: number | null | undefined;
  carbs_g: number | null | undefined;
  fat_g: number | null | undefined;
  fiber_g?: number | null | undefined;
  sugar_g?: number | null | undefined;
  className?: string;
}

const BADGES = {
  protein_g: {
    label: "P",
    badge:
      "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground",
  },
  carbs_g: {
    label: "KH",
    badge: "bg-accent/15 text-accent-foreground dark:bg-accent/20",
  },
  fat_g: {
    label: "F",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300",
  },
  fiber_g: {
    label: "BS",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300",
  },
  sugar_g: {
    label: "Z",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/35 dark:text-rose-300",
  },
} as const;

/**
 * Kompakte Makro-Anzeige (P · KH · F · BS · Z) als zentrierte Badge-Gruppe.
 * - immer 1 Nachkommastelle
 * - optionale Werte (BS/Z) nur bei vorhandenem Wert
 * - farbige Mini-Badges für die Kürzel
 */
export function MacroPills({
  protein_g,
  carbs_g,
  fat_g,
  fiber_g,
  sugar_g,
  className,
}: MacroPillsProps) {
  const items: { key: keyof typeof BADGES; value: number }[] = [
    { key: "protein_g", value: protein_g ?? 0 },
    { key: "carbs_g", value: carbs_g ?? 0 },
    { key: "fat_g", value: fat_g ?? 0 },
  ];
  if (fiber_g != null) items.push({ key: "fiber_g", value: fiber_g });
  if (sugar_g != null) items.push({ key: "sugar_g", value: sugar_g });

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-x-1.5 whitespace-nowrap",
        className,
      )}
      aria-label="Makronährstoffe"
    >
      {items.map(({ key, value }) => {
        const item = BADGES[key];
        return (
          <div
            key={key}
            className="flex shrink-0 items-center gap-0.5"
            title={`${item.label}: ${value.toFixed(1)} g`}
          >
            <span
              className={cn(
                "inline-flex h-4 min-w-[18px] shrink-0 items-center justify-center rounded px-0.5 text-[10px] font-bold leading-none",
                item.badge,
              )}
            >
              {item.label}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {value.toFixed(1)}g
            </span>
          </div>
        );
      })}
    </div>
  );

}
