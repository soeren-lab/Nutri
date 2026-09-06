import { useState } from "react";
import { Pencil, Trash2, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickEntryDialog } from "@/components/QuickEntryDialog";
import { useQuickEntryTemplates } from "@/hooks/use-quick-entry-templates";
import type { QuickEntryTemplate } from "@/lib/quick-entries";

/** "Meine Schnelleinträge" – Liste eigener Vorlagen mit Bearbeiten/Löschen. */
export function QuickEntryTemplatesSection() {
  const { templates, isLoading, updateTemplate, removeTemplate } =
    useQuickEntryTemplates();
  const [editing, setEditing] = useState<QuickEntryTemplate | null>(null);

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">Meine Schnelleinträge</p>
        <p className="text-xs text-muted-foreground">
          Vorlagen für spontane Mahlzeiten – im Planer per Schnelleintrag nutzbar.
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Wird geladen…</p>
      ) : templates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Vorlagen. Beim Schnelleintrag im Planer „Als Vorlage merken"
          aktivieren.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-2">
              <Utensils className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(Number(t.calories))} kcal
                  {t.protein_g != null && ` · P ${Math.round(Number(t.protein_g))} g`}
                  {t.carbs_g != null && ` · KH ${Math.round(Number(t.carbs_g))} g`}
                  {t.fat_g != null && ` · F ${Math.round(Number(t.fat_g))} g`}
                  {t.fiber_g != null && ` · BS ${Math.round(Number(t.fiber_g))} g`}
                  {t.sugar_g != null && ` · Z ${Math.round(Number(t.sugar_g))} g`}
                  {` · ${t.use_count}×`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Vorlage bearbeiten"
                onClick={() => setEditing(t)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Vorlage löschen"
                onClick={() => removeTemplate.mutate(t.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <QuickEntryDialog
          title="Vorlage bearbeiten"
          submitLabel="Speichern"
          showTemplateToggle={false}
          initial={{
            name: editing.name,
            calories: Number(editing.calories),
            protein_g: editing.protein_g != null ? Number(editing.protein_g) : null,
            carbs_g: editing.carbs_g != null ? Number(editing.carbs_g) : null,
            fat_g: editing.fat_g != null ? Number(editing.fat_g) : null,
            fiber_g: editing.fiber_g != null ? Number(editing.fiber_g) : null,
            sugar_g: editing.sugar_g != null ? Number(editing.sugar_g) : null,
          }}
          onClose={() => setEditing(null)}
          onSubmit={(v) => {
            updateTemplate.mutate({
              id: editing.id,
              name: v.name,
              calories: v.calories,
              protein_g: v.protein_g,
              carbs_g: v.carbs_g,
              fat_g: v.fat_g,
              fiber_g: v.fiber_g,
              sugar_g: v.sugar_g,
            });
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
