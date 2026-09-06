import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/CategoryBadge";
import { RECIPE_CATEGORIES } from "@/types/recipe";
import { getCategoryColor } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function CategoryPicker({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Vorschläge – standardmäßig die festen Kategorien, sonst dynamisch aggregiert. */
  options?: readonly string[];
}) {
  const [custom, setCustom] = useState("");

  function toggle(name: string) {
    if (value.includes(name)) onChange(value.filter((v) => v !== name));
    else onChange([...value, name]);
  }

  function addCustom() {
    const t = custom.trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setCustom("");
  }

  const pool = options && options.length > 0 ? options : RECIPE_CATEGORIES;
  const suggestions = pool.filter((c) => !value.includes(c));


  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <CategoryBadge key={v} name={v} onRemove={() => toggle(v)} />
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => {
            const c = getCategoryColor(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-solid hover:text-foreground",
                  c.border,
                )}
              >
                <Plus className="h-3 w-3" />
                {s}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Eigene Kategorie hinzufügen…"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          className="h-9"
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom} disabled={!custom.trim()}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Hinzufügen
        </Button>
      </div>
    </div>
  );
}
