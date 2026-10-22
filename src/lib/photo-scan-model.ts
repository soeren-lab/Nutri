import { useSyncExternalStore } from "react";

/**
 * Welches KI-Modell der Foto-Scan nutzt. Die Wahl liegt nur auf diesem Gerät (localStorage);
 * die NAS-API prüft sie gegen eine feste Liste (nas-api/src/photoScan.js, ALLOWED_MODELS).
 */
export type PhotoScanModelId = "claude-haiku-5-5" | "claude-sonnet-5-5";

export const PHOTO_SCAN_MODELS: {
  id: PhotoScanModelId;
  label: string;
  cost: string;
  hint: string;
}[] = [
  {
    id: "claude-haiku-5-5",
    label: "Haiku 5.5",
    cost: "ca. 0,2 Cent pro Scan",
    hint: "Sehr günstig und schnell. Mengen und schwierige Gerichte werden evtl. weniger genau geschätzt.",
  },
  {
    id: "claude-sonnet-5-5",
    label: "Sonnet 5.5",
    cost: "ca. 4 Cent pro Scan",
    hint: "Genauer bei Mengen und zusammengesetzten Gerichten, dafür deutlich teurer.",
  },
];

export const DEFAULT_PHOTO_SCAN_MODEL: PhotoScanModelId = "claude-sonnet-5-5";

const KEY = "nutri.photoScanModel";
const listeners = new Set<() => void>();

function isModelId(v: unknown): v is PhotoScanModelId {
  return PHOTO_SCAN_MODELS.some((m) => m.id === v);
}

export function getPhotoScanModel(): PhotoScanModelId {
  try {
    const v = localStorage.getItem(KEY);
    return isModelId(v) ? v : DEFAULT_PHOTO_SCAN_MODEL;
  } catch {
    return DEFAULT_PHOTO_SCAN_MODEL;
  }
}

export function setPhotoScanModel(id: PhotoScanModelId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* Speicher gesperrt – Wahl gilt dann nur bis zum Neuladen nicht */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function usePhotoScanModel(): PhotoScanModelId {
  return useSyncExternalStore(subscribe, getPhotoScanModel, () => DEFAULT_PHOTO_SCAN_MODEL);
}

export const photoScanModelLabel = (id: PhotoScanModelId) =>
  PHOTO_SCAN_MODELS.find((m) => m.id === id)?.label ?? id;
