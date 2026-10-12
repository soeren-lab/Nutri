import { Circle, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMealPhotoUrl } from "@/hooks/use-meal-photo";
import { describePlate, plateToInfo, type Plate } from "@/lib/plates";

const NONE = "__none__";
const NEW = "__new__";

/** Kleines Vorschaubild eines Tellers (oder Platzhalter). */
export function PlateThumb({ path, className }: { path: string | null; className?: string }) {
  const url = useMealPhotoUrl(path);
  return url ? (
    <img src={url} alt="" className={className ?? "h-9 w-9 rounded-lg object-cover"} />
  ) : (
    <span
      className={
        className ??
        "flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"
      }
    >
      <Circle className="h-4 w-4" />
    </span>
  );
}

/** Dropdown mit Teller-Fotos: Auswahl, „Kein Teller“ und „Neuer Teller…“. */
export function PlatePicker({
  plates,
  value,
  onChange,
  onNew,
}: {
  plates: Plate[];
  value: string | null;
  onChange: (id: string | null) => void;
  onNew: () => void;
}) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => {
        if (v === NEW) onNew();
        else onChange(v === NONE ? null : v);
      }}
    >
      <SelectTrigger className="h-auto min-h-11 py-1.5">
        <SelectValue placeholder="Teller wählen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>
          <span className="text-muted-foreground">Kein Teller (Größe aus dem Foto schätzen)</span>
        </SelectItem>
        {plates.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="flex items-center gap-2">
              <PlateThumb path={p.photo_path} />
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm">{p.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {describePlate(plateToInfo(p))}
                </span>
              </span>
            </span>
          </SelectItem>
        ))}
        <SelectItem value={NEW}>
          <span className="flex items-center gap-2 text-primary">
            <Plus className="h-4 w-4" /> Neuer Teller…
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
