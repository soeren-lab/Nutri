import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSheet } from "@/components/FormSheet";
import { IngredientThumb } from "@/components/IngredientThumb";
import { ingredientsMasterQuery, type IngredientMaster } from "@/lib/ingredients-master";
import { usageCounts } from "@/lib/fridge";

const PRODUCE = new Set(["Obst", "Gemüse"]);

function Tile({ m, onPick }: { m: IngredientMaster; onPick: (m: IngredientMaster) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(m)}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-2 text-center transition-transform active:scale-95"
    >
      <IngredientThumb path={m.image_url} size="md" />
      <span className="line-clamp-2 text-xs font-medium leading-tight">{m.name}</span>
      <span className="text-[10px] text-muted-foreground">{m.unit}</span>
    </button>
  );
}

/**
 * Schnellauswahl für alles ohne Barcode (Obst, Gemüse, lose Ware): zuerst das, was du oft
 * einlagerst, dann Obst und Gemüse, per Suche alles aus deiner Zutaten-Bibliothek.
 */
export function FridgeQuickPick({
  open,
  onOpenChange,
  onPick,
  onCreateNew,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (m: IngredientMaster) => void;
  onCreateNew: (name: string) => void;
}) {
  const { data: masters } = useQuery(ingredientsMasterQuery(false));
  const [search, setSearch] = useState("");

  const { frequent, produce, found } = useMemo(() => {
    const list = masters ?? [];
    const usage = usageCounts();
    const q = search.trim().toLowerCase();
    const byName = (a: IngredientMaster, b: IngredientMaster) => a.name.localeCompare(b.name, "de");
    return {
      frequent: list
        .filter((m) => (usage[m.id] ?? 0) > 0)
        .sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0))
        .slice(0, 9),
      produce: list.filter((m) => PRODUCE.has(m.category)).sort(byName),
      found: q ? list.filter((m) => m.name.toLowerCase().includes(q)).sort(byName) : [],
    };
  }, [masters, search]);

  const searching = search.trim().length > 0;

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="Schnellauswahl">
      <div className="space-y-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zutat suchen"
            className="pl-9"
          />
        </div>

        {searching ? (
          <div className="space-y-3">
            {found.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {found.map((m) => (
                  <Tile key={m.id} m={m} onPick={onPick} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nichts gefunden.</p>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => onCreateNew(search.trim())}
            >
              <Plus className="h-4 w-4" /> „{search.trim()}“ neu anlegen
            </Button>
          </div>
        ) : (
          <>
            {frequent.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Oft eingelagert</h3>
                <div className="grid grid-cols-3 gap-2">
                  {frequent.map((m) => (
                    <Tile key={m.id} m={m} onPick={onPick} />
                  ))}
                </div>
              </section>
            )}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Obst und Gemüse</h3>
              {produce.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {produce.map((m) => (
                    <Tile key={m.id} m={m} onPick={onPick} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Noch keine Zutaten in den Kategorien Obst oder Gemüse. Suche oben nach einer Zutat
                  oder lege sie neu an.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </FormSheet>
  );
}
