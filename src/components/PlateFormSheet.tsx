import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/FormSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlates } from "@/hooks/use-plates";
import { useMealPhotoUrl } from "@/hooks/use-meal-photo";
import { resizeImage, type ResizedImage } from "@/lib/image-resize";
import { PLATE_SHAPES, type Plate, type PlateShape } from "@/lib/plates";
import { cn } from "@/lib/utils";

const toNum = (v: string): number | null => {
  const x = Number(v.replace(",", "."));
  return v.trim() !== "" && Number.isFinite(x) && x > 0 ? x : null;
};

/** Teller/Schüssel anlegen oder bearbeiten (Maße dienen der KI als Maßstab im Foto-Scan). */
export function PlateFormSheet({
  plate,
  onClose,
  onSaved,
}: {
  plate?: Plate | null;
  onClose: () => void;
  onSaved?: (plate: Plate) => void;
}) {
  const { save } = usePlates();
  const existingUrl = useMealPhotoUrl(plate?.photo_path);
  const [name, setName] = useState(plate?.name ?? "");
  const [shape, setShape] = useState<PlateShape>(
    (PLATE_SHAPES.find((s) => s.value === plate?.shape)?.value ?? "round") as PlateShape,
  );
  const [width, setWidth] = useState(plate ? String(plate.width_cm) : "");
  const [length, setLength] = useState(plate?.length_cm != null ? String(plate.length_cm) : "");
  const [depth, setDepth] = useState(plate ? String(plate.depth_cm) : "");
  const [capacity, setCapacity] = useState(
    plate?.capacity_ml != null ? String(plate.capacity_ml) : "",
  );
  const [photo, setPhoto] = useState<ResizedImage | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const previewRef = useRef<string | null>(null);
  previewRef.current = photo?.previewUrl ?? null;
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const img = await resizeImage(file, 640, 0.8);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      setPhoto(img);
      setRemovePhoto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Foto konnte nicht geladen werden");
    } finally {
      setBusy(false);
    }
  }

  const widthNum = toNum(width);
  const depthNum = toNum(depth);
  const lengthNum = toNum(length);
  const capacityNum = toNum(capacity);
  const valid =
    name.trim().length > 0 &&
    widthNum != null &&
    widthNum <= 100 &&
    depthNum != null &&
    depthNum <= 50 &&
    (shape !== "oval" || (lengthNum != null && lengthNum <= 100)) &&
    (capacity.trim() === "" || (capacityNum != null && capacityNum <= 10000));

  async function submit() {
    if (!valid || widthNum == null || depthNum == null) return;
    try {
      const saved = await save.mutateAsync({
        existing: plate ?? null,
        values: {
          name: name.trim(),
          shape,
          width_cm: widthNum,
          length_cm: shape === "oval" ? lengthNum : null,
          depth_cm: depthNum,
          capacity_ml: capacityNum,
        },
        photo: photo?.blob ?? null,
        removePhoto,
      });
      onSaved?.(saved);
      onClose();
    } catch {
      // Fehlermeldung zeigt der Mutations-Handler
    }
  }

  const shownPhoto = photo?.previewUrl ?? (removePhoto ? null : existingUrl);
  const widthLabel = shape === "oval" ? "Breite (cm)" : "Durchmesser (cm)";

  return (
    <FormSheet
      open
      onOpenChange={(v) => !v && onClose()}
      title={plate ? "Teller bearbeiten" : "Neuer Teller"}
      footer={
        <Button
          className="w-full"
          onClick={() => void submit()}
          disabled={!valid || save.isPending || busy}
        >
          Speichern
        </Button>
      }
    >
      <div className="space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="pl-name">Name</Label>
          <Input
            id="pl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Großer Teller weiß"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Form</Label>
          <div className="flex flex-wrap gap-1.5">
            {PLATE_SHAPES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setShape(s.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  shape === s.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="pl-w">{widthLabel}</Label>
            <Input
              id="pl-w"
              inputMode="decimal"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="26"
            />
          </div>
          {shape === "oval" && (
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="pl-l">Länge (cm)</Label>
              <Input
                id="pl-l"
                inputMode="decimal"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                placeholder="32"
              />
            </div>
          )}
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="pl-d">Tiefe/Randhöhe (cm)</Label>
            <Input
              id="pl-d"
              inputMode="decimal"
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              placeholder="3"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="pl-c">Fassungsvermögen (ml)</Label>
            <Input
              id="pl-c"
              inputMode="decimal"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="optional"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Fassungsvermögen: bis zum Rand mit Wasser füllen und in einen Messbecher gießen. Das hilft
          vor allem bei Schüsseln.
        </p>

        <div className="space-y-1.5">
          <Label>Foto (optional, zur Wiedererkennung)</Label>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {shownPhoto ? (
            <div className="relative h-32 w-32">
              <img src={shownPhoto} alt="Teller" className="h-32 w-32 rounded-xl object-cover" />
              <button
                type="button"
                aria-label="Foto entfernen"
                onClick={() => {
                  if (photo) URL.revokeObjectURL(photo.previewUrl);
                  setPhoto(null);
                  setRemovePhoto(true);
                }}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="mr-1 h-3.5 w-3.5" /> Kamera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => galleryRef.current?.click()}
              >
                <ImagePlus className="mr-1 h-3.5 w-3.5" /> Galerie
              </Button>
            </div>
          )}
        </div>
      </div>
    </FormSheet>
  );
}
