import { useState } from "react";
import { Check, ChevronRight, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchSheet, SearchSheetRow } from "@/components/SearchSheet";
import { useIngredientsMaster } from "@/hooks/use-ingredients-master";
import type { IngredientMaster } from "@/lib/ingredients-master";
import { mastersInGroup, rememberGroupChoice } from "@/lib/productGroups";
import { cn } from "@/lib/utils";

/**
 * Wiederverwendbare Sorten-Auswahl für flexible Zutaten (Produktgruppen).
 * Öffnet ein SearchSheet, gefiltert auf ingredients_master.subcategory = group.
 * Wird in RecipeDetail, Kochmodus und Planer verwendet.
 */
export function FlexibleIngredientPicker({
  group,
  value,
  onSelect,
  variant = "row",
  className,
  masters: mastersProp,
  open: openProp,
  onOpenChange,
}: {
  group: string;
  /** Aktuell gewählte Stammzutat-ID. */
  value: string | null;
  onSelect: (master: IngredientMaster) => void;
  /** "row" = schlanke Zeile, "button" = Select-Button, "hidden" = nur Sheet (extern gesteuert). */
  variant?: "row" | "button" | "hidden";
  className?: string;
  masters?: IngredientMaster[];
  /** Optional kontrolliert: Sheet-Zustand von außen steuern. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const all = useIngredientsMaster();
  const list = mastersProp ?? all;
  const masters = mastersInGroup(list, group);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const selected = value ? (masters.find((m) => m.id === value) ?? null) : null;


  return (
    <>
      {variant === "button" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selected ? selected.name : `${group} wählen…`}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      ) : variant === "hidden" ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-center gap-1 rounded-md py-0.5 text-left text-xs text-primary hover:underline",
            className,
          )}
        >
          <span className="truncate">{selected ? "Sorte ändern" : "Sorte auswählen"}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        </button>
      )}

      <SearchSheet
        open={open}
        onOpenChange={setOpen}
        title={`${group} wählen`}
        placeholder="Sorte suchen…"
        items={masters}
        getSearchText={(m) => m.name}
        selectedId={value}
        emptyLabel={`Keine Zutaten in der Gruppe „${group}"`}
        onSelect={(m) => {
          rememberGroupChoice(group, m.id);
          onSelect(m);
        }}
        renderItem={(m, { selected: isSel, onSelect: pick }) => (
          <SearchSheetRow onClick={pick} selected={isSel}>
            <Check
              className={cn("h-4 w-4 shrink-0", isSel ? "text-primary opacity-100" : "opacity-0")}
            />
            <span className="min-w-0 flex-1 truncate">{m.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {m.calories != null ? `${m.calories} kcal` : m.unit}
            </span>
          </SearchSheetRow>
        )}
      />
    </>
  );
}
