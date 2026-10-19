/** Barcode (EAN/UPC): nur Ziffern, 8–14 Stellen. */
export function isValidBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code);
}

/** Entfernt Leerzeichen/Bindestriche, wie sie bei Handeingabe vorkommen. */
export function cleanBarcode(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}
