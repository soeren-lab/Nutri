import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Info, Loader2, Mic, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/FormSheet";
import { Input } from "@/components/ui/input";
import { PlateFormSheet } from "@/components/PlateFormSheet";
import { PlatePicker } from "@/components/PlatePicker";
import { SearchSheet, SearchSheetRow } from "@/components/SearchSheet";
import { usePlates } from "@/hooks/use-plates";
import { getLastPlateId, plateToInfo, setLastPlateId } from "@/lib/plates";
import { resizeImage, type ResizedImage } from "@/lib/image-resize";
import { analyzeMeal } from "@/lib/photo-scan";
import {
  computeScanTotals,
  macrosForAmount,
  roundMacros,
  summaryNameFrom,
  withAmount,
  type ScanItem,
  type ScanMacros,
  type ScanMaster,
  type ScanSource,
} from "@/lib/photoNutrition";
import type { IngredientMaster } from "@/lib/ingredients-master";
import { cn } from "@/lib/utils";

export type PhotoScanSubmit = {
  name: string;
  items: ScanItem[];
  macros: ScanMacros;
  /** Tellerfoto (JPEG) – null beim Bearbeiten eines bestehenden Eintrags. */
  photo: Blob | null;
};

type Step = "capture" | "analyzing" | "review";
type Picker = { mode: "add" } | { mode: "swap"; index: number };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Mikrofon-Knopf (Web Speech API); fehlt die Unterstützung, hilft das Tastatur-Mikrofon. */
function MicButton({ onText }: { onText: (text: string) => void }) {
  const Recognition = useMemo(() => getSpeechRecognition(), []);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recRef.current?.stop(), []);
  if (!Recognition) return null;

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Recognition!();
    rec.lang = "de-DE";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  return (
    <Button
      type="button"
      variant={listening ? "default" : "outline"}
      size="icon"
      onClick={toggle}
      aria-label={listening ? "Aufnahme beenden" : "Sprechen"}
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
}

function PhotoSlot({
  label,
  hint,
  badge,
  image,
  onPick,
  onClear,
  busy,
}: {
  label: string;
  hint: string;
  badge: string;
  image: ResizedImage | null;
  onPick: (file: File) => void;
  onClear: () => void;
  busy: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onPick(file);
  };
  return (
    <div className="flex min-h-[168px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-2 text-center">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handle}
      />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handle} />
      {image ? (
        <div className="relative w-full">
          <img src={image.previewUrl} alt={label} className="h-28 w-full rounded-xl object-cover" />
          <button
            type="button"
            onClick={onClear}
            aria-label={`${label} entfernen`}
            className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-[11px] text-muted-foreground">{hint}</p>
            <span className="mt-1 inline-block rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {badge}
            </span>
          </div>
          <div className="flex w-full flex-col gap-1.5">
            <Button
              type="button"
              size="sm"
              className="w-full"
              variant="secondary"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="mr-1 h-3.5 w-3.5" /> Kamera
            </Button>
            <Button
              type="button"
              size="sm"
              className="w-full"
              variant="outline"
              disabled={busy}
              onClick={() => galleryRef.current?.click()}
            >
              <ImagePlus className="mr-1 h-3.5 w-3.5" /> Galerie
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

const SOURCE_DOT: Record<ScanSource, { cls: string; label: string }> = {
  library: { cls: "bg-primary", label: "aus deiner Bibliothek" },
  table: { cls: "bg-primary/60", label: "Richtwert" },
  estimate: { cls: "bg-amber-500", label: "grobe Schätzung" },
  unknown: { cls: "bg-destructive", label: "keine Nährwerte" },
};

function toScanMaster(m: IngredientMaster): ScanMaster {
  return {
    id: m.id,
    name: m.name,
    unit: m.unit,
    calories: m.calories,
    protein_g: m.protein_g,
    carbs_g: m.carbs_g,
    fat_g: m.fat_g,
    fiber_g: m.fiber_g,
    sugar_g: m.sugar_g,
    density_g_per_ml: m.density_g_per_ml,
  };
}

/**
 * Foto-Scan (Max): Essensfoto + optional Zutatenfoto + Sprachnotiz → Positionen,
 * alles bearbeitbar, danach als Planer-Eintrag. Mit `initial` wird ein bestehender
 * Eintrag bearbeitet (ohne neues Foto).
 */
export function PhotoScanSheet({
  title,
  masters,
  initial,
  submitLabel = "Eintragen",
  onClose,
  onSubmit,
}: {
  title: string;
  masters: IngredientMaster[];
  initial?: { name: string; items: ScanItem[] };
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (v: PhotoScanSubmit) => void;
}) {
  const scanMasters = useMemo(() => masters.map(toScanMaster), [masters]);
  const masterMap = useMemo(() => new Map(scanMasters.map((m) => [m.id, m])), [scanMasters]);

  const [step, setStep] = useState<Step>(initial ? "review" : "capture");
  const [food, setFood] = useState<ResizedImage | null>(null);
  const [ref, setRef] = useState<ResizedImage | null>(null);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ScanItem[]>(initial?.items ?? []);
  const [name, setName] = useState(initial?.name ?? "");
  const [question, setQuestion] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<Picker | null>(null);
  const { plates } = usePlates();
  const [plateId, setPlateId] = useState<string | null>(null);
  const [plateFormOpen, setPlateFormOpen] = useState(false);
  const plateInit = useRef(false);
  // Zuletzt benutzten Teller vorauswählen, sobald die Liste geladen ist.
  useEffect(() => {
    if (plateInit.current || plates.length === 0) return;
    plateInit.current = true;
    const last = getLastPlateId();
    if (last && plates.some((p) => p.id === last)) setPlateId(last);
  }, [plates]);
  const selectedPlate = plates.find((p) => p.id === plateId) ?? null;

  // Vorschau-URLs beim Schließen freigeben.
  const previews = useRef<string[]>([]);
  previews.current = [food?.previewUrl, ref?.previewUrl].filter(Boolean) as string[];
  useEffect(
    () => () => {
      previews.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  async function pick(kind: "food" | "ref", file: File) {
    setBusy(true);
    try {
      const img = await resizeImage(file);
      if (kind === "food") {
        if (food) URL.revokeObjectURL(food.previewUrl);
        setFood(img);
      } else {
        if (ref) URL.revokeObjectURL(ref.previewUrl);
        setRef(img);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Foto konnte nicht geladen werden");
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    if (!food) return;
    setStep("analyzing");
    try {
      const res = await analyzeMeal({
        image: food.base64,
        refImage: ref?.base64,
        note: note.trim() || undefined,
        plate: selectedPlate ? plateToInfo(selectedPlate) : undefined,
        masters: scanMasters,
      });
      setLastPlateId(plateId);
      setItems(res.items);
      setName(res.summary_name);
      setQuestion(res.question);
      setStep("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auswertung fehlgeschlagen");
      setStep("capture");
    }
  }

  async function applyCorrection() {
    const text = correction.trim();
    if (!text) return;
    setBusy(true);
    try {
      const res = await analyzeMeal({
        previous: items,
        correction: text,
        plate: selectedPlate ? plateToInfo(selectedPlate) : undefined,
        masters: scanMasters,
      });
      setItems(res.items);
      setQuestion(res.question);
      setCorrection("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Korrektur fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  const totals = useMemo(() => computeScanTotals(items, masterMap), [items, masterMap]);
  const macros = roundMacros(totals.macros);
  const round10 = (n: number) => Math.round(n / 10) * 10;
  const valid = items.length > 0 && items.every((i) => i.amount > 0);

  function setAmount(index: number, raw: string) {
    const n = Number(raw.replace(",", "."));
    setItems((list) =>
      list.map((it, i) =>
        i === index ? (Number.isFinite(n) && n > 0 ? withAmount(it, n) : { ...it, amount: 0 }) : it,
      ),
    );
  }

  function chooseMaster(m: IngredientMaster) {
    const defaultAmount = m.unit === "Stück" ? 1 : 100;
    const make = (amount: number): ScanItem => ({
      name: m.name,
      master_id: m.id,
      amount,
      unit: m.unit,
      low: amount * 0.8,
      high: amount * 1.2,
      confidence: "medium",
      per100: null,
    });
    setItems((list) => {
      if (picker?.mode === "swap") {
        return list.map((it, i) => {
          if (i !== picker.index) return it;
          const keep = it.unit === m.unit && it.amount > 0;
          return keep ? { ...make(it.amount), low: it.low, high: it.high } : make(defaultAmount);
        });
      }
      return [...list, make(defaultAmount)];
    });
    setPicker(null);
  }

  function submit() {
    if (!valid) return;
    onSubmit({
      name: name.trim() || summaryNameFrom(items, masterMap),
      items,
      macros,
      photo: food?.blob ?? null,
    });
  }

  const footer =
    step === "capture" ? (
      <Button className="w-full" onClick={analyze} disabled={!food || busy}>
        <Sparkles className="mr-2 h-4 w-4" /> Auswerten
      </Button>
    ) : step === "review" ? (
      <Button className="w-full" onClick={submit} disabled={!valid || busy}>
        {submitLabel}
      </Button>
    ) : undefined;

  return (
    <>
      <FormSheet open onOpenChange={(v) => !v && onClose()} title={title} footer={footer}>
        {step === "capture" && (
          <div className="space-y-3 p-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Teller oder Schüssel (die Maße dienen als Maßstab)
              </p>
              <PlatePicker
                plates={plates}
                value={plateId}
                onChange={setPlateId}
                onNew={() => setPlateFormOpen(true)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PhotoSlot
                label="Essen"
                hint="live oder aus der Galerie"
                badge="kommt in den Planer"
                image={food}
                busy={busy}
                onPick={(f) => void pick("food", f)}
                onClear={() => {
                  if (food) URL.revokeObjectURL(food.previewUrl);
                  setFood(null);
                }}
              />
              <PhotoSlot
                label="Zutaten"
                hint="z. B. Schüssel Olivenöl"
                badge="optional"
                image={ref}
                busy={busy}
                onPick={(f) => void pick("ref", f)}
                onClear={() => {
                  if (ref) URL.revokeObjectURL(ref.previewUrl);
                  setRef(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Notiz (optional): was man nicht sieht, z. B. Öl, Sauce, Käse
              </p>
              <div className="flex items-start gap-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="z. B. Reis mit Hähnchen, ein Löffel Öl aus der Schüssel"
                  className="min-h-[72px] flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                />
                <MicButton onText={(t) => setNote((n) => (n ? `${n} ${t}` : t))} />
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Die Fotos werden zur Auswertung an eine KI geschickt. Das Essensfoto wird privat in
              deinem Planer gespeichert, das Zutatenfoto nicht.
            </p>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm font-medium">Dein Essen wird ausgewertet…</p>
            <p className="text-xs text-muted-foreground">Das dauert ein paar Sekunden.</p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              {food && (
                <img
                  src={food.previewUrl}
                  alt="Essen"
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
              )}
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name der Mahlzeit"
                aria-label="Name der Mahlzeit"
              />
            </div>

            <ul className="divide-y divide-border rounded-xl border border-border">
              {items.map((it, i) => {
                const { source } = macrosForAmount(it, Math.max(it.amount, 0.0001), masterMap);
                const dot = SOURCE_DOT[source];
                return (
                  <li key={`${it.name}-${i}`} className="space-y-1 p-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("h-2 w-2 shrink-0 rounded-full", dot.cls)}
                        title={dot.label}
                      />
                      <button
                        type="button"
                        onClick={() => setPicker({ mode: "swap", index: i })}
                        className="min-w-0 flex-1 truncate text-left text-sm"
                        title="Zutat tauschen"
                      >
                        {it.name}
                      </button>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={it.amount > 0 ? String(Math.round(it.amount * 10) / 10) : ""}
                        onChange={(e) => setAmount(i, e.target.value)}
                        aria-label={`Menge ${it.name}`}
                        className="h-8 w-20 text-right"
                      />
                      <span className="w-9 shrink-0 text-xs text-muted-foreground">{it.unit}</span>
                      <button
                        type="button"
                        onClick={() => setItems((list) => list.filter((_, j) => j !== i))}
                        aria-label={`${it.name} entfernen`}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {source === "unknown" && (
                      <p className="pl-4 text-[11px] text-destructive">
                        Keine Nährwerte bekannt – tippe auf den Namen und wähle eine Zutat.
                      </p>
                    )}
                    {source === "estimate" && (
                      <p className="pl-4 text-[11px] text-muted-foreground">
                        Nicht in deiner Bibliothek – grobe Schätzung.
                      </p>
                    )}
                  </li>
                );
              })}
              <li className="p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setPicker({ mode: "add" })}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Position hinzufügen
                </Button>
              </li>
            </ul>

            <div className="space-y-2 rounded-xl bg-muted/50 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-semibold tabular-nums">{macros.calories} kcal</span>
                {totals.kcalHigh > totals.kcalLow && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {round10(totals.kcalLow)} bis {round10(totals.kcalHigh)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-1 text-center">
                {(
                  [
                    ["F", macros.fat_g],
                    ["KH", macros.carbs_g],
                    ["Z", macros.sugar_g],
                    ["BS", macros.fiber_g],
                    ["P", macros.protein_g],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="rounded-lg bg-background py-1.5">
                    <p className="text-sm font-semibold tabular-nums">{v}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Schätzung aus Foto, Nährwerte stammen aus deiner Bibliothek.
              </p>
            </div>

            {question && (
              <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {question}
              </p>
            )}

            {!initial && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Stimmt etwas nicht? Sag oder schreib, was anders ist
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    placeholder="z. B. weniger Käse, dazu ein Brot"
                    onKeyDown={(e) => e.key === "Enter" && void applyCorrection()}
                  />
                  <MicButton onText={(t) => setCorrection((c) => (c ? `${c} ${t}` : t))} />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    disabled={busy || !correction.trim()}
                    onClick={() => void applyCorrection()}
                    aria-label="Änderung anwenden"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </FormSheet>

      {plateFormOpen && (
        <PlateFormSheet onClose={() => setPlateFormOpen(false)} onSaved={(p) => setPlateId(p.id)} />
      )}

      <SearchSheet
        open={!!picker}
        onOpenChange={(v) => !v && setPicker(null)}
        title={picker?.mode === "swap" ? "Zutat tauschen" : "Position hinzufügen"}
        placeholder="Lebensmittel suchen…"
        items={masters}
        getSearchText={(m) => m.name}
        emptyLabel="Keine Lebensmittel vorhanden"
        onSelect={chooseMaster}
        renderItem={(m, ctx) => (
          <SearchSheetRow onClick={ctx.onSelect} selected={ctx.selected}>
            <span className="min-w-0 flex-1 truncate">{m.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {m.calories != null
                ? `${m.calories} kcal / ${m.unit === "Stück" ? "Stück" : `100 ${m.unit}`}`
                : m.unit}
            </span>
          </SearchSheetRow>
        )}
      />
    </>
  );
}
