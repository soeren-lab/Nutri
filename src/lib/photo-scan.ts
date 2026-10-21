import { apiPost } from "@/lib/db-client";
import type { ScanItem, ScanMaster } from "@/lib/photoNutrition";
import type { PlateInfo } from "@/lib/plates";

export type AnalyzeInput = {
  /** Base64-JPEG ohne data:-Präfix. */
  image?: string;
  refImage?: string;
  note?: string;
  previous?: ScanItem[];
  correction?: string;
  plate?: PlateInfo;
  masters: ScanMaster[];
};

export type AnalyzeResult = {
  summary_name: string;
  items: ScanItem[];
  question: string | null;
  cost_usd: number;
  balance_usd: number | null;
};

/** Schickt Foto(s)/Korrektur an die KI-Auswertung auf der NAS (prüft Max-Plan, Guthaben, Tageslimit). */
export async function analyzeMeal(input: AnalyzeInput): Promise<AnalyzeResult> {
  const { masters, ...rest } = input;
  const res = await apiPost<AnalyzeResult>("/ai/photo-scan", {
    ...rest,
    candidates: masters.slice(0, 400).map((m) => ({
      id: m.id,
      name: m.name.slice(0, 80),
      unit: m.unit,
    })),
  });
  if (res.error || !res.data)
    throw new Error(res.error?.message ?? "Die KI-Auswertung ist fehlgeschlagen.");
  return res.data;
}
