import { useState } from "react";
import { Check, ChevronsUpDown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchSheet, SearchSheetRow } from "@/components/SearchSheet";
import { useIngredientsMaster } from "@/hooks/use-ingredients-master";
import { mastersInGroup, productGroups } from "@/lib/productGroups";
import { cn } from "@/lib/utils";

/** Auswahl einer Produktgruppe (Untergruppe der Stammzutaten). */
export function ProductGroupSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (group: string) => void;
}) {
  const list = useIngredientsMaster();
  const [open, setOpen] = useState(false);
  const groups = productGroups(list).map((g) => ({ id: g, name: g }));

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
      >
        <span className="truncate">{value || "Produktgruppe wählen…"}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <SearchSheet
        open={open}
        onOpenChange={setOpen}
        title="Produktgruppe wählen"
        placeholder="Gruppe suchen…"
        items={groups}
        getSearchText={(g) => g.name}
        selectedId={value}
        emptyLabel="Noch keine Untergruppen bei Zutaten vergeben"
        onSelect={(g) => onChange(g.name)}
        renderItem={(g, { selected, onSelect }) => (
          <SearchSheetRow onClick={onSelect} selected={selected}>
            <Check
              className={cn("h-4 w-4 shrink-0", selected ? "text-primary opacity-100" : "opacity-0")}
            />
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{g.name}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {mastersInGroup(list, g.name).length} Produkte
            </span>
          </SearchSheetRow>
        )}
      />
    </>
  );
}
