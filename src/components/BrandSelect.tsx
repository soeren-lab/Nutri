import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SearchSheet, SearchSheetRow } from "@/components/SearchSheet";
import { useBrands } from "@/hooks/use-brands";
import { createBrand, type Brand } from "@/lib/brands";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function BrandSelect({
  brandId,
  onChange,
}: {
  brandId: string | null;
  onChange: (brandId: string | null) => void;
}) {
  const brands = useBrands();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const selected = brandId ? brands.find((b) => b.id === brandId) ?? null : null;

  const createMut = useMutation({
    mutationFn: (name: string) => createBrand(name),
    onSuccess: (b: Brand) => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      onChange(b.id);
      setOpen(false);
      toast.success("Marke angelegt");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full justify-between font-normal",
          !selected && "text-muted-foreground",
        )}
      >
        <span className="truncate">
          {selected ? selected.name : "Marke wählen…"}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {selected && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          aria-label="Marke entfernen"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <SearchSheet
        open={open}
        onOpenChange={setOpen}
        title="Marke wählen"
        placeholder="Marke suchen oder neu anlegen…"
        items={brands}
        getSearchText={(b) => b.name}
        selectedId={brandId}
        onSelect={(b) => onChange(b.id)}
        emptyLabel="Noch keine Marken"
        onCreate={(name) => createMut.mutate(name)}
        createLabel={(q) => <>„{q}" als neue Marke anlegen</>}
        renderItem={(b, { selected, onSelect }) => (
          <SearchSheetRow onClick={onSelect} selected={selected}>
            <Check
              className={cn(
                "h-4 w-4",
                selected ? "opacity-100 text-primary" : "opacity-0",
              )}
            />
            <span className="flex-1 truncate">{b.name}</span>
          </SearchSheetRow>
        )}
      />
    </div>
  );
}
