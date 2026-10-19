import { isNativeApp } from "@/lib/platform";
import { isValidBarcode } from "@/lib/barcode";

/** Ob ein Kamera-Scan möglich ist (nur in der Android-App). Sonst Handeingabe. */
export function canScanBarcode(): boolean {
  return isNativeApp();
}

/**
 * Öffnet den nativen ML-Kit-Scanner. Gibt den Barcode zurück oder `null`,
 * wenn der Nutzer abbricht. Wirft bei echten Fehlern (Modul fehlt, keine Kamera).
 */
export async function scanBarcode(): Promise<string | null> {
  const { BarcodeScanner, BarcodeFormat } = await import("@capacitor-mlkit/barcode-scanning");

  // Der Google-Scanner ist ein nachladbares Play-Services-Modul.
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (!available) {
    await BarcodeScanner.installGoogleBarcodeScannerModule();
    throw new Error(
      "Scanner wird gerade installiert – bitte in einer Minute noch einmal versuchen.",
    );
  }

  try {
    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE],
      autoZoom: true,
    });
    const code = barcodes[0]?.rawValue ?? "";
    return isValidBarcode(code) ? code : null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Abbruch durch den Nutzer ist kein Fehler.
    if (/cancel|abbr/i.test(msg)) return null;
    throw e;
  }
}
