import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlateFormSheet } from "@/components/PlateFormSheet";
import { PlateThumb } from "@/components/PlatePicker";
import { usePlates } from "@/hooks/use-plates";
import { describePlate, plateToInfo, type Plate } from "@/lib/plates";

/** Verwaltung der eigenen Teller/Schüsseln (Einstellungen). */
export function PlatesSection() {
  const { plates, isLoading, remove } = usePlates();
  const [editing, setEditing] = useState<Plate | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">
        Hinterlege deine Teller und Schüsseln mit Maßen. Beim Foto-Scan wählst du den passenden aus,
        und die KI nutzt die Maße als Maßstab für die Mengen.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : plates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Noch keine Teller angelegt.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {plates.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <PlateThumb
                path={p.photo_path}
                className="h-12 w-12 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {describePlate(plateToInfo(p))}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${p.name} bearbeiten`}
                onClick={() => setEditing(p)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${p.name} löschen`}
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`„${p.name}“ löschen?`)) remove.mutate(p);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button className="w-full" variant="secondary" onClick={() => setCreating(true)}>
        <Plus className="mr-2 h-4 w-4" /> Neuer Teller
      </Button>

      {creating && <PlateFormSheet onClose={() => setCreating(false)} />}
      {editing && <PlateFormSheet plate={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}
