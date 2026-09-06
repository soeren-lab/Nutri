import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useUnseenPatchNotes } from "@/hooks/use-unseen-patch-notes";

/** Zeigt ungesehene Patch Notes nacheinander im freundlichen App-Stil. */
export function PatchNoteModal() {
  const { notes, markSeen } = useUnseenPatchNotes();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [notes.length === 0]);

  const note = notes[index];
  if (!note) return null;

  const isLast = index >= notes.length - 1;

  function confirm() {
    markSeen.mutate(note!.id);
    if (isLast) setIndex(0);
    else setIndex((i) => i + 1);
  }

  return (
    <Dialog open onOpenChange={() => confirm()}>
      <DialogContent
        className="max-h-[85vh] gap-0 overflow-y-auto rounded-3xl border-border p-0 sm:max-w-md"
      >
        <div className="space-y-2 p-6 pb-4 [background:linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--accent)/0.12))]">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-primary-foreground [background:var(--primary-gradient)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Neu in der App
          </p>
          <h2 className="text-2xl font-bold leading-tight tracking-tight">
            {note.title}
          </h2>
        </div>

        <div className="space-y-5 p-6 pt-5">
          {note.sections.map((s) => (
            <section key={s.id} className="space-y-1">
              {s.subtitle && (
                <h3 className="text-sm font-semibold text-primary">{s.subtitle}</h3>
              )}
              {s.content && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {s.content}
                </p>
              )}
            </section>
          ))}

          <div className="flex items-center justify-between gap-3 pt-1">
            {notes.length > 1 ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {index + 1} / {notes.length}
              </span>
            ) : (
              <span />
            )}
            <Button onClick={confirm} className="rounded-xl">
              {isLast ? "Verstanden" : "Weiter"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
