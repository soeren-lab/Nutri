import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { usePatchNotes } from "@/hooks/use-patch-notes";

type Draft = { subtitle: string; content: string };

/** Dev-only: Patch Notes erstellen und verwalten. */
export function PatchNotesDevSection() {
  const { isAdmin } = useIsAdmin();
  const { notes, publish, remove } = usePatchNotes();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<Draft[]>([{ subtitle: "", content: "" }]);

  if (!isAdmin) return null;

  function reset() {
    setTitle("");
    setSections([{ subtitle: "", content: "" }]);
    setOpen(false);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-dashed border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Entwickler</p>
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          Patch Notes erstellen
        </Button>
      </div>

      {open && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            publish.mutate({ title, sections }, { onSuccess: reset });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pn-title">Überschrift</Label>
            <Input
              id="pn-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Update 1.4"
            />
          </div>

          {sections.map((s, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={s.subtitle}
                  placeholder="Unter-Überschrift"
                  onChange={(e) =>
                    setSections((prev) =>
                      prev.map((p, j) =>
                        j === i ? { ...p, subtitle: e.target.value } : p,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Absatz ${i + 1} entfernen`}
                  onClick={() => setSections((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={s.content}
                rows={3}
                placeholder="Text"
                onChange={(e) =>
                  setSections((prev) =>
                    prev.map((p, j) => (j === i ? { ...p, content: e.target.value } : p)),
                  )
                }
              />
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSections((p) => [...p, { subtitle: "", content: "" }])}
          >
            <Plus className="mr-1 h-4 w-4" /> Absatz hinzufügen
          </Button>

          <div className="flex gap-2">
            <Button type="submit" disabled={publish.isPending} className="flex-1">
              Senden
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Abbrechen
            </Button>
          </div>
        </form>
      )}

      {notes.length > 0 && (
        <ul className="divide-y divide-border">
          {notes.map((n) => (
            <li key={n.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{n.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleDateString("de-DE")} ·{" "}
                  {n.sections.length} Absätze
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Patch Note löschen"
                onClick={() => remove.mutate(n.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
