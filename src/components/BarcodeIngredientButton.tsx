import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { IngredientMasterFormDialog } from "@/components/IngredientMasterFormDialog";
import { db } from "@/integrations/db/client";
import { canScanBarcode, scanBarcode } from "@/lib/barcode-scan";
import { cleanBarcode, isValidBarcode } from "@/lib/barcode";
import type { IngredientMaster, IngredientPrefill } from "@/lib/ingredients-master";
import { OFF_SOURCE, lookupBarcode, resolveBrandId } from "@/lib/openfoodfacts";

/**
 * Zutat per Barcode anlegen: scannen (App) bzw. Nummer eintippen (Web),
 * in Open Food Facts nachschlagen und das Anlegen-Formular vorbefüllt öffnen.
 */
export function BarcodeIngredientButton({
  onSaved,
  className,
}: {
  onSaved?: (m: IngredientMaster) => void;
  className?: string;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<IngredientPrefill | undefined>();
  const [existing, setExisting] = useState<IngredientMaster | undefined>();

  async function handleCode(code: string) {
    setBusy(true);
    try {
      const { data: userRes } = await db.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Nicht angemeldet");

      const { data: own } = await db
        .from("ingredients_master")
        .select("*")
        .eq("user_id", uid)
        .eq("source_barcode", code)
        .limit(1)
        .maybeSingle();
      if (own) {
        if (own.archived) {
          const { error } = await db
            .from("ingredients_master")
            .update({ archived: false })
            .eq("id", own.id);
          if (error) throw error;
          void qc.invalidateQueries({ queryKey: ["ingredients_master"] });
          toast.success(`„${own.name}" wiederhergestellt`);
        } else {
          toast.info(`„${own.name}" hast du schon in deiner Bibliothek`);
        }
        setPrefill(undefined);
        setExisting({ ...own, archived: false });
        setFormOpen(true);
        return;
      }

      const { product, error } = await lookupBarcode(code);
      if (error) {
        toast.error(error);
        return;
      }
      if (!product) {
        toast.info("Produkt nicht in Open Food Facts gefunden. Trag die Werte selbst ein.");
        setExisting(undefined);
        setPrefill({ source_barcode: code });
        setFormOpen(true);
        return;
      }
      if (product.calories == null) {
        toast.info("Produkt gefunden, aber ohne Nährwerte. Trag sie vom Etikett ein.");
      }
      const brand_id = await resolveBrandId(uid, product.brand);
      void qc.invalidateQueries({ queryKey: ["brands"] });
      setExisting(undefined);
      setPrefill({
        name: product.name,
        brand_id,
        image_url: product.imageUrl,
        unit: product.unit,
        calories: product.calories,
        protein_g: product.protein_g,
        carbs_g: product.carbs_g,
        fat_g: product.fat_g,
        fiber_g: product.fiber_g,
        sugar_g: product.sugar_g,
        source: OFF_SOURCE,
        source_barcode: product.id,
      });
      setFormOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Barcode konnte nicht verarbeitet werden");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
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

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => void start()}
        disabled={busy}
        className={className ?? "gap-1.5"}
        aria-label="Barcode scannen"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanBarcode className="h-4 w-4" />}
        Scannen
      </Button>

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
            disabled={!isValidBarcode(manualCode) || busy}
            onClick={() => {
              setManualOpen(false);
              setManual("");
              void handleCode(manualCode);
            }}
          >
            Nachschlagen
          </Button>
        </DialogContent>
      </Dialog>

      <IngredientMasterFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        existing={existing}
        prefill={prefill}
        onSaved={onSaved}
      />
    </>
  );
}
