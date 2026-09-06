import {
  Apple,
  Ban,
  ClipboardPaste,
  CookingPot,
  Flame,
  ImageIcon,
  Link2,
  Plus,
  Sparkles,
  Utensils,
} from "lucide-react";

import { useSignedImage } from "@/hooks/use-signed-image";
import { batchRoleOf } from "@/lib/batch";
import { getCategoryGradient } from "@/lib/categories";
import {
  entryAmountLabel,
  entryCategory,
  entryImageUrl,
  entryKcal,
  entryTitle,
  entryVariantTag,
  formatEntryTime,
  type MealPlanEntryFull,
} from "@/lib/meal-plan";
import { cn } from "@/lib/utils";

/** Ein geplanter Eintrag als kompakte Listen-Zeile. */
export function MealEntryRow({
  entry,
  onClick,
  className,
}: {
  entry: MealPlanEntryFull;
  onClick: () => void;
  className?: string;
}) {
  const { data: imageUrl } = useSignedImage(entryImageUrl(entry));
  const kcal = entryKcal(entry);
  const amount = entryAmountLabel(entry);
  const isQuick = entry.food_type === "quick_entry";
  const category = entryCategory(entry);
  const variantTag = entryVariantTag(entry);
  const timeLabel = formatEntryTime(entry.created_at);
  const stripeColor = category
    ? getCategoryGradient(category).from
    : "hsl(var(--muted-foreground))";
  // „Koch-Tag" nur am tatsächlichen Koch-Tag; alle Verzehrtage sind „Vorgekocht".
  const rawBatchRole = batchRoleOf(entry);
  const batchRole =
    rawBatchRole === "start" && entry.batch_cook_date && entry.date !== entry.batch_cook_date
      ? "leftover"
      : rawBatchRole;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-3 overflow-hidden bg-card py-2.5 pl-3 pr-2 text-left transition-colors hover:bg-accent/5",
        entry.skipped && "opacity-50",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-0 w-1 rounded-full",
          batchRole === "leftover" && "opacity-50",
        )}
        style={{ backgroundColor: stripeColor }}
      />
      {batchRole !== "none" && (
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-1.5 w-1.5 rounded-l-md border-y border-l border-primary/40"
        />
      )}

      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/40">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-muted-foreground">
            {isQuick ? (
              <Utensils className="h-4 w-4" />
            ) : entry.food_type === "ingredient" ? (
              <Apple className="h-4 w-4" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "line-clamp-1 text-sm font-semibold text-foreground",
              entry.skipped && "line-through",
            )}
          >
            {entryTitle(entry)}
          </span>
          {kcal != null && (
            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
              <Flame className="h-3.5 w-3.5 text-primary" />
              {Math.round(kcal)}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {isQuick ? (
            timeLabel ? (
              <span className="truncate text-xs text-muted-foreground">{timeLabel}</span>
            ) : (
              <span className="truncate text-xs text-muted-foreground">Schnelleintrag</span>
            )
          ) : (
            amount && <span className="truncate text-xs text-muted-foreground">{amount}</span>
          )}
          {variantTag && (
            <span className="truncate text-xs text-muted-foreground">· {variantTag}</span>
          )}
          {entry.skipped && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-muted-foreground/30 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Ban className="h-3 w-3" /> Ausgelassen
            </span>
          )}
          {batchRole !== "none" && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {batchRole === "start" ? (
                <>
                  <CookingPot className="h-3 w-3" /> Koch-Tag
                </>
              ) : (
                <>
                  <Link2 className="h-3 w-3" /> Vorgekocht
                </>
              )}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** Zeile am Ende eines Slots: Eintrag hinzufügen, einfügen oder Vorschlag holen. */
export function SlotAddRow({
  label,
  onAdd,
  onSuggest,
  onPaste,
  className,
}: {
  label?: string;
  onAdd: () => void;
  onSuggest: () => void;
  onPaste?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-xl border border-dashed border-border/70 p-1 text-muted-foreground",
        className,
      )}
    >
      {label && <span className="w-20 shrink-0 pl-1 text-xs font-medium sm:hidden">{label}</span>}
      <button
        type="button"
        onClick={onAdd}
        aria-label="Eintrag hinzufügen"
        className="flex min-h-8 flex-1 items-center justify-center rounded-lg transition-colors hover:text-primary"
      >
        <Plus className="h-4 w-4" />
      </button>
      {onPaste && (
        <button
          type="button"
          onClick={onPaste}
          aria-label="Kopierten Eintrag einfügen"
          className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <ClipboardPaste className="h-3.5 w-3.5" /> Einfügen
        </button>
      )}
      <button
        type="button"
        onClick={onSuggest}
        aria-label="Vorschlag anzeigen"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:text-primary"
      >
        <Sparkles className="h-4 w-4" />
      </button>
    </div>
  );
}
