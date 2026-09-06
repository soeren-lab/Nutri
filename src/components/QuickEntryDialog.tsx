import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Info, Sparkles, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/FormSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  matchCommonDishes,
  matchTemplates,
  quickEntryTemplatesQuery,
  type QuickEntryTemplate,
  type QuickEntryValues,
} from "@/lib/quick-entries";
import { cn } from "@/lib/utils";


export type QuickEntrySubmit = QuickEntryValues & {
  saveAsTemplate: boolean;
  templateId: string | null;
};

const numOrNull = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};

/**
 * Formular für spontane Mahlzeiten (Restaurant, Essen gehen).
 * Beim Tippen werden eigene Vorlagen und generische Gerichte vorgeschlagen.
 */
export function QuickEntryDialog({
  title,
  initial,
  showTemplateToggle = true,
  submitLabel = "Eintragen",
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: Partial<QuickEntryValues>;
  showTemplateToggle?: boolean;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (v: QuickEntrySubmit) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [calories, setCalories] = useState(
    initial?.calories != null ? String(initial.calories) : "",
  );
  const [protein, setProtein] = useState(
    initial?.protein_g != null ? String(initial.protein_g) : "",
  );
  const [carbs, setCarbs] = useState(
    initial?.carbs_g != null ? String(initial.carbs_g) : "",
  );
  const [fat, setFat] = useState(initial?.fat_g != null ? String(initial.fat_g) : "");
  const [fiber, setFiber] = useState(
    initial?.fiber_g != null ? String(initial.fiber_g) : "",
  );
  const [sugar, setSugar] = useState(
    initial?.sugar_g != null ? String(initial.sugar_g) : "",
  );
  const [details, setDetails] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [estimated, setEstimated] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [touchedList, setTouchedList] = useState(true);

  const { data: templates = [] } = useQuery(quickEntryTemplatesQuery());

  const ownMatches = useMemo(
    () => (name.trim() ? matchTemplates(templates, name) : []),
    [templates, name],
  );
  const dishMatches = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    const own = new Set(ownMatches.map((t) => t.name.toLowerCase()));
    return matchCommonDishes(name).filter((d) => !own.has(d.name.toLowerCase()));
  }, [name, ownMatches]);

  const showList = touchedList && (ownMatches.length > 0 || dishMatches.length > 0);

  function fill(v: QuickEntryValues, isEstimate: boolean, id: string | null) {
    setName(v.name);
    setCalories(String(v.calories));
    setProtein(v.protein_g != null ? String(v.protein_g) : "");
    setCarbs(v.carbs_g != null ? String(v.carbs_g) : "");
    setFat(v.fat_g != null ? String(v.fat_g) : "");
    setFiber(v.fiber_g != null ? String(v.fiber_g) : "");
    setSugar(v.sugar_g != null ? String(v.sugar_g) : "");
    setEstimated(isEstimate);
    setTemplateId(id);
    setTouchedList(false);
    if (
      v.protein_g != null ||
      v.carbs_g != null ||
      v.fat_g != null ||
      v.fiber_g != null ||
      v.sugar_g != null
    )
      setDetails(true);
  }

  function applyTemplate(t: QuickEntryTemplate) {
    fill(
      {
        name: t.name,
        calories: Number(t.calories),
        protein_g: t.protein_g != null ? Number(t.protein_g) : null,
        carbs_g: t.carbs_g != null ? Number(t.carbs_g) : null,
        fat_g: t.fat_g != null ? Number(t.fat_g) : null,
        fiber_g: t.fiber_g != null ? Number(t.fiber_g) : null,
        sugar_g: t.sugar_g != null ? Number(t.sugar_g) : null,
      },
      false,
      t.id,
    );
  }

  const kcal = numOrNull(calories);
  const valid = name.trim().length > 0 && kcal != null && kcal > 0;

  return (
    <FormSheet
      open
      onOpenChange={(v: boolean) => !v && onClose()}
      title={title}
      footer={
        <Button
          className="w-full"
          disabled={!valid}
          onClick={() =>
            valid &&
            onSubmit({
              name: name.trim(),
              calories: kcal,
              protein_g: numOrNull(protein),
              carbs_g: numOrNull(carbs),
              fat_g: numOrNull(fat),
              fiber_g: numOrNull(fiber),
              sugar_g: numOrNull(sugar),
              saveAsTemplate,
              templateId,
            })
          }
        >
          {submitLabel}
        </Button>
      }
    >
      <div className="space-y-3">

          <div className="space-y-1.5">
            <Label htmlFor="qe-name">Name</Label>
            <Input
              id="qe-name"
              value={name}
              autoFocus
              placeholder="z. B. Pizza im Restaurant"
              onChange={(e) => {
                setName(e.target.value);
                setTouchedList(true);
                setTemplateId(null);
                setEstimated(false);
              }}
            />
            {showList && (
              <ul className="max-h-44 overflow-y-auto rounded-xl border border-border bg-card">
                {ownMatches.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
                    >
                      <Utensils className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {Math.round(Number(t.calories))} kcal
                      </span>
                    </button>
                  </li>
                ))}
                {dishMatches.map((d) => (
                  <li key={d.name}>
                    <button
                      type="button"
                      onClick={() => fill(d, true, null)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
                    >
                      <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{d.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {d.hint} · geschätzt
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {d.calories} kcal
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qe-kcal">Kalorien (kcal)</Label>
            <Input
              id="qe-kcal"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
          </div>

          {estimated && (
            <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Geschätzt – bitte anpassen falls bekannt.
            </p>
          )}

          <button
            type="button"
            onClick={() => setDetails((d) => !d)}
            className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Details (Protein / KH / Fett / Ballaststoffe / Zucker)
            <ChevronDown className={cn("h-4 w-4 transition-transform", details && "rotate-180")} />
          </button>
          {details && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="qe-p" className="text-xs">
                  Protein (g)
                </Label>
                <Input
                  id="qe-p"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qe-kh" className="text-xs">
                  KH (g)
                </Label>
                <Input
                  id="qe-kh"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qe-f" className="text-xs">
                  Fett (g)
                </Label>
                <Input
                  id="qe-f"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qe-bs" className="text-xs">
                  Ballaststoffe (g)
                </Label>
                <Input
                  id="qe-bs"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={fiber}
                  onChange={(e) => setFiber(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qe-z" className="text-xs">
                  Zucker (g)
                </Label>
                <Input
                  id="qe-z"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={sugar}
                  onChange={(e) => setSugar(e.target.value)}
                />
              </div>
            </div>
          )}

          {showTemplateToggle && (
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <Label htmlFor="qe-tpl" className="text-sm font-normal">
                Als Vorlage merken
              </Label>
              <Switch
                id="qe-tpl"
                checked={saveAsTemplate}
                onCheckedChange={setSaveAsTemplate}
              />
            </div>
          )}
      </div>
    </FormSheet>

  );
}
