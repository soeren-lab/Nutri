import type { ScanItem } from "@/lib/photoNutrition";

/**
 * Letztes (noch nicht eingetragenes) Scan-Ergebnis lokal merken, damit es nach einem
 * versehentlichen Schließen oder Absturz nicht verloren ist. Das Foto selbst wird nicht gespeichert.
 */
const KEY = "nutri.photoScan.pending.v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PendingScan = { name: string; items: ScanItem[]; savedAt: number };

export function readPendingScan(): PendingScan | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingScan;
    if (!Array.isArray(p.items) || p.items.length === 0) return null;
    if (Date.now() - Number(p.savedAt) > MAX_AGE_MS) return null;
    return p;
  } catch {
    return null;
  }
}

export function writePendingScan(name: string, items: ScanItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ name, items, savedAt: Date.now() }));
  } catch {
    /* Speicher gesperrt – dann gibt es nur keine Wiederherstellung */
  }
}

export function clearPendingScan(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorieren */
  }
}
