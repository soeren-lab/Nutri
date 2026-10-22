import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Refrigerator, ScanBarcode, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FridgeItemSheet, type FridgeSheetMaster } from "@/components/FridgeItemSheet";
import { FridgeQuickPick } from "@/components/FridgeQuickPick";
import { IngredientMasterFormDialog } from "@/components/IngredientMasterFormDialog";
import { IngredientThumb } from "@/components/IngredientThumb";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/use-auth";
import { canScanBarcode, scanBarcode } from "@/lib/barcode-scan";
import { cleanBarcode, isValidBarcode } from "@/lib/barcode";
import { resolveBarcode } from "@/lib/barcode-lookup";
import { groupByCategory } from "@/lib/categories";
import {
  FRIDGE_LOCATIONS,
  expiryLabel,
  expiryTone,
  formatAmount,
  fridgeQuery,
  type ExpiryTone,
  type FridgeItem,
  type FridgeLocation,
} from "@/lib/fridge";
import type { IngredientMaster, IngredientPrefill } from "@/lib/ingredients-master";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<ExpiryTone, string> = {
  none: "",
  ok: "text-emerald-700 dark:text-emerald-300",
  soon: "text-amber-700 dark:text-amber-300",
  expired: "text-red-700 dark:text-red-300",
};

const TONE_RING: Record<ExpiryTone, string> = {
  none: "border-white/60 dark:border-white/10",
  ok: "border-white/60 dark:border-white/10",
  soon: "border-amber-400/70",
  expired: "border-red-400/80",
};

function toSheetMaster(m: IngredientMaster): FridgeSheetMaster {
  return {
    id: m.id,
    name: m.name,
    unit: m.unit,
    image_url: m.image_url,
    category: m.category,
  };
}

/** Warnstreifen: der Kühlschrank ist noch im Aufbau. */
function WorkInProgressBanner() {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-2xl border border-amber-400/60 bg-amber-50 px-3 py-2.5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-xs leading-snug">
        <span className="font-semibold">In Arbeit.</span> Der Kühlschrank wächst Schritt für
        Schritt. Bisher kannst du Produkte einlagern und ansehen; Abzug über Einkauf und Planer
        folgt.
      </p>
    </div>
  );
}

function ItemTile({ item, onOpen }: { item: FridgeItem; onOpen: () => void }) {
  const tone = expiryTone(item.expires_at);
  const label = expiryLabel(item.expires_at);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex flex-col items-center gap-1 rounded-2xl border bg-white/70 p-2 text-center shadow-sm backdrop-blur transition-transform active:scale-95 dark:bg-white/5",
        TONE_RING[tone],
      )}
    >
      <IngredientThumb path={item.master?.image_url} size="md" />
      <span className="line-clamp-2 min-h-[2rem] text-xs font-semibold leading-tight">
        {item.master?.name ?? "Unbekannt"}
      </span>
      <span className="text-[11px] font-medium text-muted-foreground">
        {formatAmount(item.amount, item.unit)}
      </span>
      <span
        className={cn("min-h-[0.875rem] text-[10px] font-medium leading-none", TONE_STYLES[tone])}
      >
        {label}
      </span>
    </button>
  );
}

/** Ein Fach im Kühlschrank: Überschrift, Produkte, darunter die Glasablage. */
function Shelf({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: FridgeItem[];
  onOpen: (i: FridgeItem) => void;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-sky-900/70 dark:text-sky-100/60">
        {title}
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {items.map((i) => (
          <ItemTile key={i.id} item={i} onOpen={() => onOpen(i)} />
        ))}
      </div>
      <div
        aria-hidden
        className="h-2 rounded-full bg-gradient-to-b from-white/90 to-sky-200/70 shadow-[0_3px_6px_-2px_rgba(14,116,144,0.35)] dark:from-white/20 dark:to-sky-300/10"
      />
    </section>
  );
}

export function FridgeView() {
  const { user } = useAuth();
  const { data: items, isLoading } = useQuery(fridgeQuery());
  const [location, setLocation] = useState<FridgeLocation>("fridge");

  const [sheet, setSheet] = useState<{
    master: FridgeSheetMaster;
    item: FridgeItem | null;
    packHint: number | null;
  } | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState("");

  // Unbekanntes Produkt: Zutat muss jetzt angelegt werden, erst danach geht es in den Kühlschrank.
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<IngredientPrefill | undefined>();
  const [formName, setFormName] = useState<string | undefined>();
  const pendingPack = useRef<number | null>(null);
  const formSaved = useRef(false);

  const counts = useMemo(() => {
    const c: Record<FridgeLocation, number> = { fridge: 0, freezer: 0, pantry: 0 };
    for (const i of items ?? []) {
      const loc = (i.location as FridgeLocation) in c ? (i.location as FridgeLocation) : "fridge";
      c[loc]++;
    }
    return c;
  }, [items]);

  const soonCount = useMemo(
    () =>
      (items ?? []).filter((i) => {
        const t = expiryTone(i.expires_at);
        return t === "soon" || t === "expired";
      }).length,
    [items],
  );

  const shelves = useMemo(() => {
    const here = (items ?? [])
      .filter((i) => i.location === location)
      .sort((a, b) => {
        const ea = a.expires_at ?? "9999";
        const eb = b.expires_at ?? "9999";
        return ea === eb
          ? (a.master?.name ?? "").localeCompare(b.master?.name ?? "", "de")
          : ea.localeCompare(eb);
      });
    return groupByCategory(here, (i) => i.master?.category ?? "Sonstiges");
  }, [items, location]);

  function openAdd(master: IngredientMaster, packHint: number | null) {
    setSheet({ master: toSheetMaster(master), item: null, packHint });
  }

  function openEdit(item: FridgeItem) {
    if (!item.master) return;
    setSheet({
      master: {
        id: item.master.id,
        name: item.master.name,
        unit: item.master.unit,
        image_url: item.master.image_url,
        category: item.master.category,
        brandName: item.master.brand?.name ?? null,
      },
      item,
      packHint: null,
    });
  }

  function startCreate(prefillValue: IngredientPrefill | undefined, name: string | undefined) {
    formSaved.current = false;
    setPrefill(prefillValue);
    setFormName(name);
    setFormOpen(true);
  }

  async function handleCode(code: string) {
    if (!user) return;
    setBusy(true);
    try {
      const res = await resolveBarcode(code, user.id);
      if (res.kind === "own") {
        if (res.restored) toast.success(`„${res.master.name}“ wiederhergestellt`);
        openAdd(res.master, res.packAmount);
        return;
      }
      pendingPack.current = res.packAmount;
      toast.info(res.notice ?? "Neues Produkt: lege die Zutat jetzt an, danach kommt es hinein.");
      startCreate(res.prefill, undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Barcode konnte nicht verarbeitet werden");
    } finally {
      setBusy(false);
    }
  }

  async function startScan() {
    if (!canScanBarcode()) {
      setManualOpen(true);
      return;
    }
    try {
      const code = await scanBarcode();
      if (code) await handleCode(code);
      else toast.info("Kein gültiger Barcode erkannt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scanner nicht verfügbar");
      setManualOpen(true);
    }
  }

  const manualCode = cleanBarcode(manual);

  if (isLoading) return <LoadingSpinner />;

  const total = (items ?? []).length;

  return (
    <div className="space-y-4">
      <WorkInProgressBanner />

      <div className="overflow-hidden rounded-[28px] border border-sky-200/80 bg-gradient-to-b from-sky-50 via-cyan-50 to-sky-100 p-3 shadow-lg dark:border-sky-300/15 dark:from-sky-950/60 dark:via-slate-900 dark:to-sky-950/40">
        <div className="flex items-center gap-3 px-1 pb-3 pt-1">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/80 text-sky-700 shadow-sm dark:bg-white/10 dark:text-sky-200">
            <Refrigerator className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight text-sky-950 dark:text-sky-50">
              Mein Kühlschrank
            </h1>
            <p className="text-xs text-sky-900/70 dark:text-sky-100/60">
              {total === 0
                ? "Noch leer"
                : `${total} Produkt${total === 1 ? "" : "e"}${
                    soonCount > 0 ? `, ${soonCount} bald abgelaufen` : ""
                  }`}
            </p>
          </div>
          {soonCount > 0 && (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pb-3">
          <Button
            type="button"
            onClick={() => void startScan()}
            disabled={busy || !user}
            className="h-12 gap-2 rounded-2xl text-sm font-semibold"
            style={{ background: "var(--primary-gradient)" }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanBarcode className="h-5 w-5" />
            )}
            Scannen
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuickOpen(true)}
            className="h-12 gap-2 rounded-2xl bg-white/70 text-sm font-semibold dark:bg-white/5"
          >
            <Sparkles className="h-5 w-5" />
            Schnellauswahl
          </Button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-white/60 p-1 dark:bg-white/5">
          {FRIDGE_LOCATIONS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLocation(l.id)}
              className={cn(
                "rounded-xl px-1 py-1.5 text-xs font-semibold transition-all",
                location === l.id
                  ? "bg-white text-sky-900 shadow dark:bg-sky-300/20 dark:text-sky-50"
                  : "text-sky-900/60 dark:text-sky-100/50",
              )}
            >
              {l.label}
              <span className="ml-1 text-[10px] font-medium opacity-70">{counts[l.id]}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4 rounded-2xl border border-white/70 bg-gradient-to-b from-white/50 to-white/20 p-2.5 dark:border-white/10 dark:from-white/5 dark:to-transparent">
          {shelves.length === 0 ? (
            <div className="grid place-items-center gap-2 px-4 py-10 text-center">
              <Refrigerator className="h-10 w-10 text-sky-700/50 dark:text-sky-200/40" />
              <p className="text-sm font-semibold text-sky-950 dark:text-sky-50">
                Hier ist noch nichts drin
              </p>
              <p className="text-xs text-sky-900/70 dark:text-sky-100/60">
                Scanne beim Auspacken jedes Produkt oder nimm die Schnellauswahl für Obst und
                Gemüse.
              </p>
            </div>
          ) : (
            shelves.map((g) => (
              <Shelf key={g.category} title={g.category} items={g.items} onOpen={openEdit} />
            ))
          )}
        </div>
      </div>

      <FridgeQuickPick
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onPick={(m) => {
          setQuickOpen(false);
          openAdd(m, null);
        }}
        onCreateNew={(name) => {
          setQuickOpen(false);
          pendingPack.current = null;
          startCreate(undefined, name);
        }}
      />

      <FridgeItemSheet
        open={sheet !== null}
        onOpenChange={(o) => !o && setSheet(null)}
        master={sheet?.master ?? null}
        item={sheet?.item ?? null}
        packHint={sheet?.packHint ?? null}
      />

      <IngredientMasterFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o && !formSaved.current) {
            toast.info("Nicht eingelagert: Ohne angelegte Zutat gibt es keinen Eintrag.");
          }
        }}
        prefill={prefill}
        defaultName={formName}
        onSaved={(m) => {
          formSaved.current = true;
          setFormOpen(false);
          openAdd(m, pendingPack.current);
        }}
      />

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Barcode eingeben</DialogTitle>
          </DialogHeader>
          <Input
            inputMode="numeric"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="z. B. 4006381333931"
            autoFocus
          />
          <Button
            type="button"
            disabled={!isValidBarcode(manualCode)}
            onClick={() => {
              setManualOpen(false);
              setManual("");
              void handleCode(manualCode);
            }}
          >
            Suchen
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
