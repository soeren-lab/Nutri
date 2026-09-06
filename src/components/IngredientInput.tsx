import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Sparkles, AlertTriangle, ChevronDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { NutritionValue } from "@/components/NutritionInput";
import { IngredientSelect } from "@/components/IngredientSelect";
import { ProductGroupSelect } from "@/components/ProductGroupSelect";
import { GROUP_HINT } from "@/lib/productGroups";
import { useIngredientsMaster } from "@/hooks/use-ingredients-master";
import {
  UNIT_GROUPS,
  UNIT_OPTIONS,
  computeNutritionFromMaster,
  normalizeUnit,
} from "@/lib/unitConversion";

export interface IngredientDraft {
  /** Stable client-side id for accordion state. */
  _uid: string;
  name: string;
  amount: number | "";
  unit: string;
  nutrition: NutritionValue;
  ingredient_master_id: string | null;
  /** Produktgruppe (z.B. „Nudeln") – Sorte wird erst beim Kochen gewählt. */
  product_group?: string | null;
  /** Manuelle Nährwerte-Übersteuerung trotz verknüpfter Stammzutat. */
  override_nutrition?: boolean;
}



const NUTRITION_FIELDS: Array<{
  key: keyof NutritionValue;
  label: string;
  unit: string;
}> = [
  { key: "calories", label: "kcal", unit: "" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "KH", unit: "g" },
  { key: "fat_g", label: "Fett", unit: "g" },
  { key: "fiber_g", label: "Ballaststoffe", unit: "g" },
  { key: "sugar_g", label: "Zucker", unit: "g" },
];

export function IngredientInput({
  value,
  onChange,
  onRemove,
  index,
  showNutrition = false,
  expanded = true,
  onToggleExpand,
}: {
  value: IngredientDraft;
  onChange: (v: IngredientDraft) => void;
  onRemove: () => void;
  index: number;
  showNutrition?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {

  const masterList = useIngredientsMaster();
  const master = value.ingredient_master_id
    ? (masterList.find((m) => m.id === value.ingredient_master_id) ?? null)
    : null;

  const normalizedUnit = normalizeUnit(value.unit);
  const isKnownUnit = value.unit === "" || (UNIT_OPTIONS as readonly string[]).includes(normalizedUnit);
  const isCustomUnit = value.unit !== "" && !isKnownUnit;
  const unitSelectValue =
    value.unit === "" ? "__none" : isCustomUnit ? "__custom" : normalizedUnit;

  // Live-Berechnung inkl. Einheiten-Umrechnung
  const computed = useMemo(() => {
    if (!master) return null;
    return computeNutritionFromMaster(
      master,
      value.amount === "" ? null : Number(value.amount),
      value.unit || null,
    );
  }, [master, value.amount, value.unit]);

  const override = !!value.override_nutrition;
  const showManualForMaster = master && (override || (computed && !computed.convertible));
  // Wichtig: leerer String bedeutet „Gruppe gewählt, Name noch offen".
  const isGroup = value.product_group != null;

  /** Umschalten zwischen festem Produkt und Produktgruppe. */
  function setMode(mode: "product" | "group") {
    if ((isGroup ? "group" : "product") === mode) return;
    if (mode === "group") {
      onChange({
        ...value,
        product_group: "",
        ingredient_master_id: null,
        override_nutrition: false,
        nutrition: { calories: "", protein_g: "", carbs_g: "", fat_g: "", fiber_g: "", sugar_g: "" },
      });
    } else {
      onChange({ ...value, product_group: null });
    }
  }

  const groupName = value.product_group?.trim() ?? "";
  const displayName = isGroup
    ? groupName
      ? `${groupName} (${GROUP_HINT})`
      : `Produktgruppe ${index + 1}`
    : (master?.name ?? value.name)?.trim() || `Zutat ${index + 1}`;
  const amountLabel =
    value.amount !== "" && value.amount != null
      ? `${value.amount}${value.unit ? ` ${value.unit}` : ""}`
      : value.unit || "";


  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/50 shadow-sm">
      {/* Accordion header */}
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
      >
        {isGroup && <Layers className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {displayName}
        </span>
        {isGroup && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            Gruppe
          </span>
        )}
        {amountLabel && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {amountLabel}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Accordion body */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-3 border-t border-border/60 p-3">
            {/* Modus: festes Produkt oder Produktgruppe */}
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
              {(
                [
                  ["product", "Festes Produkt"],
                  ["group", "Produktgruppe"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    (isGroup ? "group" : "product") === m
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Name (autocomplete) bzw. Produktgruppe + Remove */}
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {isGroup ? `Produktgruppe ${index + 1}` : `Zutat ${index + 1}`}
                </Label>
                {isGroup ? (
                  <>
                    <ProductGroupSelect
                      value={value.product_group ?? null}
                      onChange={(g) =>
                        onChange({
                          ...value,
                          product_group: g,
                          name: g,
                          ingredient_master_id: null,
                          override_nutrition: false,
                          nutrition: { calories: "", protein_g: "", carbs_g: "", fat_g: "", fiber_g: "", sugar_g: "" },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Sorte wird beim Kochen bzw. Einplanen gewählt.
                    </p>
                  </>
                ) : (
                  <IngredientSelect
                    name={value.name}
                    masterId={value.ingredient_master_id}
                    onSelectMaster={(m) => {
                      onChange({
                        ...value,
                        name: m.name,
                        unit: normalizeUnit(m.unit),
                        ingredient_master_id: m.id,
                        product_group: null,
                        override_nutrition: false,
                        nutrition: { calories: "", protein_g: "", carbs_g: "", fat_g: "", fiber_g: "", sugar_g: "" },
                      });
                    }}
                    onNameChange={(n) =>
                      onChange({
                        ...value,
                        name: n,
                        ingredient_master_id: null,
                        product_group: null,
                        override_nutrition: false,
                      })
                    }
                    onClearMaster={() =>
                      onChange({ ...value, ingredient_master_id: null, override_nutrition: false })
                    }
                  />
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                aria-label={`Zutat ${index + 1} entfernen`}
                className="mt-6 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>



      {/* Row 2: Amount + Unit (immer editierbar, auch mit Stammzutat) */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Menge</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="0"
            aria-label={`Zutat ${index + 1} Menge`}
            value={value.amount}
            onChange={(e) =>
              onChange({
                ...value,
                amount: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Einheit
            {master ? (
              <span className="ml-1 opacity-70">
                (Basis: {normalizeUnit(master.unit)})
              </span>
            ) : null}
          </Label>
          {isCustomUnit ? (
            <div className="flex gap-1">
              <Input
                aria-label={`Zutat ${index + 1} Einheit`}
                value={value.unit}
                onChange={(e) => onChange({ ...value, unit: e.target.value })}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ ...value, unit: "" })}
                className="px-2 text-xs text-muted-foreground"
              >
                Liste
              </Button>
            </div>
          ) : (
            <Select
              value={unitSelectValue}
              onValueChange={(v) => {
                if (v === "__none") onChange({ ...value, unit: "" });
                else if (v === "__custom") onChange({ ...value, unit: " " });
                else onChange({ ...value, unit: v });
              }}
            >
              <SelectTrigger aria-label={`Zutat ${index + 1} Einheit`}>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">
                  <span className="text-muted-foreground">—</span>
                </SelectItem>
                {UNIT_GROUPS.map((g) => (
                  <SelectGroup key={g.label}>
                    <SelectLabel>{g.label}</SelectLabel>
                    {g.units.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                <SelectItem value="__custom">
                  <span className="text-muted-foreground">Andere…</span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Row 3: Nährwerte */}
      {isGroup ? (
        <div className="space-y-1 border-t border-dashed border-border pt-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" />
            Nährwerte
          </div>
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            wird bei Auswahl der Sorte berechnet
          </div>
        </div>
      ) : showNutrition && master ? (

        <div className="space-y-2 border-t border-dashed border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {showManualForMaster ? (
                override ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Manuell angepasst (nur dieses Rezept)
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    Umrechnung nicht möglich – manuell eingeben
                  </>
                )
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Automatisch berechnet
                </>
              )}
            </span>
            <div className="flex items-center gap-3">
              {computed && computed.convertible && (
                <label className="inline-flex items-center gap-2 text-xs">
                  <Switch
                    checked={override}
                    onCheckedChange={(v) =>
                      onChange({ ...value, override_nutrition: v })
                    }
                    aria-label="Nährwerte manuell anpassen"
                  />
                  <span>Anpassen</span>
                </label>
              )}
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    ingredient_master_id: null,
                    override_nutrition: false,
                  })
                }
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                Verknüpfung lösen
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {NUTRITION_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{f.label}</span>
                  {f.unit && <span className="text-[10px] opacity-60">{f.unit}</span>}
                </Label>
                {showManualForMaster ? (
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    aria-label={`Zutat ${index + 1} ${f.label}`}
                    value={value.nutrition[f.key]}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        nutrition: {
                          ...value.nutrition,
                          [f.key]: e.target.value === "" ? "" : Number(e.target.value),
                        },
                      })
                    }
                    className="h-9 text-sm"
                  />
                ) : (
                  <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
                    {computed && computed[f.key] != null ? computed[f.key] : "–"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : showNutrition ? (
        <div className="space-y-2 border-t border-dashed border-border pt-3">
          <div className="text-xs font-medium text-muted-foreground">Nährwerte</div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {NUTRITION_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{f.label}</span>
                  {f.unit && <span className="text-[10px] opacity-60">{f.unit}</span>}
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  aria-label={`Zutat ${index + 1} ${f.label}`}
                  value={value.nutrition[f.key]}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      nutrition: {
                        ...value.nutrition,
                        [f.key]: e.target.value === "" ? "" : Number(e.target.value),
                      },
                    })
                  }
                  className="h-9 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

