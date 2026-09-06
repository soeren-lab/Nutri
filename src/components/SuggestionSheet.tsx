import { Apple, BookOpen, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { AiMealSuggestion } from "@/lib/aiSuggestions.functions";
import type { MacroTotals } from "@/lib/meal-plan";
import type { Suggestion, SuggestionResult } from "@/lib/mealSuggestions";

const r = (n: number) => Math.round(n);

function SuggestionRow({
  s,
  onPick,
  label,
}: {
  s: Suggestion;
  onPick: (s: Suggestion) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(s)}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <span className="mt-0.5 text-muted-foreground">
        {s.kind === "recipe" ? (
          <BookOpen className="h-4 w-4" />
        ) : (
          <Apple className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.title}</span>
          {label && (
            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {label}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
          {s.kind === "recipe" ? `${s.servings} Portion` : `${s.amount} ${s.unit}`} ·{" "}
          {r(s.macros.calories)} kcal · P {r(s.macros.protein_g)} g
        </span>
        <span className="mt-1 block text-[11px] leading-tight text-primary">{s.reason}</span>
      </span>
    </button>
  );
}

function AiSuggestionRow({
  s,
  onPick,
  onSaveAsRecipe,
}: {
  s: AiMealSuggestion;
  onPick: (s: AiMealSuggestion) => void;
  onSaveAsRecipe?: (s: AiMealSuggestion) => void;
}) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
      <button
        type="button"
        onClick={() => onPick(s)}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className="mt-0.5 text-primary">
          <Wand2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
            <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              KI-Idee
            </span>
          </span>
          <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
            ca. {r(s.estimated_kcal)} kcal · P {r(s.estimated_protein_g)} g · KH{" "}
            {r(s.estimated_carbs_g)} g · F {r(s.estimated_fat_g)} g · BS{" "}
            {r(s.estimated_fiber_g)} g
          </span>
          {s.description && (
            <span className="mt-1 block text-[11px] leading-tight text-muted-foreground">
              {s.description}
            </span>
          )}
          {s.main_ingredients.length > 0 && (
            <span className="mt-1 block text-[11px] leading-tight text-primary">
              {s.main_ingredients.join(", ")}
            </span>
          )}
        </span>
      </button>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="secondary" className="h-7 flex-1 text-[11px]" onClick={() => onPick(s)}>
          Als Schnelleintrag
        </Button>
        {onSaveAsRecipe && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 flex-1 text-[11px]"
            onClick={() => onSaveAsRecipe(s)}
          >
            Als Rezept speichern
          </Button>
        )}
      </div>
    </div>
  );
}


/**
 * Zeigt passende Vorschläge für das verbleibende Tagesbudget – Rezepte primär,
 * Einzel-Lebensmittel als Ergänzungen, KI-Ideen als Fallback bei zu wenig Treffern.
 */
export function SuggestionSheet({
  open,
  onOpenChange,
  title,
  remaining,
  suggestions,
  aiSuggestions,
  aiLoading,
  aiError,
  onPick,
  onPickAi,
  onSaveAiAsRecipe,

  onManual,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  remaining: MacroTotals | null;
  suggestions: SuggestionResult;
  aiSuggestions?: AiMealSuggestion[];
  aiLoading?: boolean;
  aiError?: string | null;
  onPick: (s: Suggestion) => void;
  onPickAi?: (s: AiMealSuggestion) => void;
  onSaveAiAsRecipe?: (s: AiMealSuggestion) => void;

  onManual: () => void;
}) {
  const hasRecipes = suggestions.recipes.length > 0;
  const hasSupplements = suggestions.supplements.length > 0;
  const ai = aiSuggestions ?? [];
  const showAiSection = aiLoading || !!aiError || ai.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Vorschläge · {title}
          </DialogTitle>
        </DialogHeader>

        {remaining && (
          <p className="text-xs tabular-nums text-muted-foreground">
            Budget für diese Mahlzeit: {r(remaining.calories)} kcal · P {r(remaining.protein_g)} g
            · KH {r(remaining.carbs_g)} g · F {r(remaining.fat_g)} g · BS{" "}
            {r(remaining.fiber_g)} g
          </p>
        )}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {!hasRecipes && !hasSupplements && !showAiSection && (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
              Keine passenden Vorschläge, wähle manuell.
            </p>
          )}

          {hasRecipes && (
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Rezepte
              </h3>
              {suggestions.recipes.map((s) => (
                <SuggestionRow key={s.key} s={s} onPick={onPick} />
              ))}
            </section>
          )}

          {hasSupplements && (
            <section className="space-y-2 border-t border-border pt-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ergänzungen
              </h3>
              {suggestions.supplements.map((s) => (
                <SuggestionRow key={s.key} s={s} onPick={onPick} label="Ergänzung" />
              ))}
            </section>
          )}

          {showAiSection && (
            <section className="space-y-2 border-t border-border pt-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                KI-Ideen · nur Schätzwerte
              </h3>
              {aiLoading && (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-primary/30 px-3 py-4 text-sm text-muted-foreground">
                  <LoadingSpinner /> KI denkt nach …
                </div>
              )}
              {!aiLoading && aiError && (
                <p className="rounded-xl border border-dashed border-border px-3 py-3 text-center text-sm text-muted-foreground">
                  {aiError}
                </p>
              )}
              {!aiLoading &&
                onPickAi &&
                ai.map((s) => (
                  <AiSuggestionRow
                    key={s.name}
                    s={s}
                    onPick={onPickAi}
                    onSaveAsRecipe={onSaveAiAsRecipe}
                  />
                ))}

            </section>
          )}
        </div>

        <Button variant="secondary" onClick={onManual}>
          Manuell auswählen
        </Button>
      </DialogContent>
    </Dialog>
  );
}
