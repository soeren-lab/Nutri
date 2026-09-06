import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MASTER_UNITS,
  createIngredientMaster,
  updateIngredientMaster,
  uploadIngredientImage,
  collectSubcategories,
  type IngredientMaster,
} from "@/lib/ingredients-master";
import { useIngredientsMaster } from "@/hooks/use-ingredients-master";

import { normalizeUnit } from "@/lib/unitConversion";
import { useSignedIngredientImage } from "@/hooks/use-signed-image";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BrandSelect } from "@/components/BrandSelect";
import { INGREDIENT_CATEGORIES, DEFAULT_INGREDIENT_CATEGORY } from "@/lib/categories";


type NumField = number | "";

export function IngredientMasterFormDialog({
  open,
  onOpenChange,
  existing,
  defaultName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: IngredientMaster;
  defaultName?: string;
  onSaved?: (m: IngredientMaster) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(DEFAULT_INGREDIENT_CATEGORY);
  const [subcategory, setSubcategory] = useState("");
  const [unit, setUnit] = useState<string>("g");

  const [calories, setCalories] = useState<NumField>("");
  const [protein, setProtein] = useState<NumField>("");
  const [carbs, setCarbs] = useState<NumField>("");
  const [fat, setFat] = useState<NumField>("");
  const [fiber, setFiber] = useState<NumField>("");
  const [sugar, setSugar] = useState<NumField>("");
  const [density, setDensity] = useState<NumField>("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: signedUrl } = useSignedIngredientImage(imagePath);
  const allMasters = useIngredientsMaster(true);
  const subcategoryOptions = collectSubcategories(allMasters);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? defaultName ?? "");
    setBrandId(existing?.brand_id ?? null);
    setCategory(existing?.category ?? DEFAULT_INGREDIENT_CATEGORY);
    setSubcategory(existing?.subcategory ?? "");
    setUnit(existing ? normalizeUnit(existing.unit) : "g");

    setCalories(existing?.calories ?? "");
    setProtein(existing?.protein_g ?? "");
    setCarbs(existing?.carbs_g ?? "");
    setFat(existing?.fat_g ?? "");
    setFiber(existing?.fiber_g ?? "");
    setSugar(existing?.sugar_g ?? "");
    setDensity(existing?.density_g_per_ml ?? "");
    setImagePath(existing?.image_url ?? null);
    setLocalPreview(null);
  }, [open, existing, defaultName]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setUploading(true);
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Nicht angemeldet");
      const preview = URL.createObjectURL(file);
      setLocalPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return preview;
      });
      const path = await uploadIngredientImage(uid, file);
      setImagePath(path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }

  function removeImage() {
    setImagePath(null);
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
  }

  function buildPayload() {
    return {
      name: name.trim(),
      brand_id: brandId,
      image_url: imagePath,
      unit,
      category,
      subcategory: subcategory.trim() || null,

      calories: calories === "" ? null : Number(calories),
      protein_g: protein === "" ? null : Number(protein),
      carbs_g: carbs === "" ? null : Number(carbs),
      fat_g: fat === "" ? null : Number(fat),
      fiber_g: fiber === "" ? null : Number(fiber),
      sugar_g: sugar === "" ? null : Number(sugar),
      density_g_per_ml: density === "" ? null : Number(density),
    };
  }

  const mutation = useMutation({
    onMutate: (id: string) => {
      // ID wird vorab erzeugt statt von der DB vergeben, damit die Zutat auch
      // offline sofort im Cache sichtbar ist und unverändert synchronisiert wird.
      const previous = qc.getQueriesData<IngredientMaster[]>({ queryKey: ["ingredients_master"] });
      const optimistic: IngredientMaster = {
        ...(existing ?? ({} as IngredientMaster)),
        ...buildPayload(),
        id,
        user_id: existing?.user_id ?? "",
        archived: existing?.archived ?? false,
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as IngredientMaster;
      qc.setQueriesData(
        { queryKey: ["ingredients_master"] },
        (old: IngredientMaster[] | undefined) => {
          const list = old ?? [];
          const idx = list.findIndex((m) => m.id === id);
          if (idx === -1) return [...list, optimistic];
          return list.map((m, i) => (i === idx ? optimistic : m));
        },
      );
      toast.success(existing ? "Zutat aktualisiert" : "Zutat angelegt");
      onSaved?.(optimistic);
      onOpenChange(false);
      return { previous };
    },
    mutationFn: async (id: string) => {
      const payload = buildPayload();
      return existing
        ? updateIngredientMaster(existing.id, payload)
        : createIngredientMaster(payload, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients_master"] });
    },
    onError: (e, _id, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(e instanceof Error ? e.message : "Fehler");
    },
  });

  const perLabel = unit === "Stück" ? "pro Stück" : `pro 100 ${unit}`;
  const showDensity = unit === "g" || unit === "ml";
  const previewUrl = localPreview ?? signedUrl ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-md flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{existing ? "Zutat bearbeiten" : "Neue Zutat"}</DialogTitle>
          <DialogDescription>
            Nährwerte {perLabel}. Werden bei Rezepten anhand der Menge automatisch berechnet.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!name.trim()) {
              toast.error("Name erforderlich");
              return;
            }
            mutation.mutate(existing?.id ?? crypto.randomUUID());
          }}
          className="-mx-6 min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-1"
        >
          <div className="flex gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="justify-start"
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {previewUrl ? "Bild ersetzen" : "Bild hochladen"}
              </Button>
              {previewUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeImage}
                  className="justify-start text-muted-foreground"
                >
                  <X className="mr-2 h-4 w-4" /> Entfernen
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="im-name">Name *</Label>
            <Input
              id="im-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="im-brand">Marke</Label>
            <BrandSelect brandId={brandId} onChange={setBrandId} />
          </div>

          <div className="space-y-1.5">
            <Label>Kategorie *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INGREDIENT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="im-subcategory">Untergruppe (optional)</Label>
            <Input
              id="im-subcategory"
              list="im-subcategory-options"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="z. B. Nudeln, Whey Protein, Reis"
              maxLength={80}
            />
            <datalist id="im-subcategory-options">
              {subcategoryOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>



          <div className="space-y-1.5">
            <Label>Basis-Einheit</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MASTER_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {(
              [
                ["kcal", calories, setCalories],
                ["Protein (g)", protein, setProtein],
                ["KH (g)", carbs, setCarbs],
                ["Fett (g)", fat, setFat],
                ["Ballaststoffe (g)", fiber, setFiber],
                ["davon Zucker (g)", sugar, setSugar],
              ] as const
            ).map(([label, val, setter]) => (
              <div key={label} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={val}
                  onChange={(e) =>
                    setter(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="h-9 text-sm"
                />
              </div>
            ))}
          </div>

          {showDensity && (
            <div className="space-y-1.5">
              <Label htmlFor="im-density" className="text-xs text-muted-foreground">
                Dichte (g/ml) – optional, für Umrechnung Volumen ↔ Gewicht
              </Label>
              <Input
                id="im-density"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="z. B. 0.92 (Öl), 1.03 (Milch)"
                value={density}
                onChange={(e) => setDensity(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-9 text-sm"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
