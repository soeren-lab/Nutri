export function getProteinFactor(protein_g: number | null | undefined, calories: number | null | undefined): number {
  const p = protein_g ?? 0;
  const kcal = calories ?? 0;
  if (kcal === 0) return 0;
  const factor = (p * 10) / kcal;
  return Math.max(0, Math.min(1, factor));
}

export function getColorForFactor(factor: number): string {
  const clamped = Math.max(0, Math.min(1, factor));
  const hue = Math.round(clamped * 142);
  // Sättigung/Helligkeit kommen aus dem Theme (Light vs. Dark Mode).
  return `hsl(${hue} var(--status-sat, 70%) var(--status-light, 40%))`;
}

export function getNutritionColor(
  protein_g: number | null | undefined,
  calories: number | null | undefined,
  fallback = "var(--muted-foreground)",
): string {
  if (calories == null || protein_g == null) return fallback;
  return getColorForFactor(getProteinFactor(protein_g, calories));
}

/**
 * Farbe für Zielerreichung (Ist/Soll) – gleiche Skala wie getColorForFactor:
 * <50 % gedämpft, 80–110 % grün, >130 % Warnfarbe.
 */
export function getTargetRatioColor(
  value: number | null | undefined,
  target: number | null | undefined,
): string {
  if (!target || target <= 0 || value == null) return "var(--muted-foreground)";
  const ratio = value / target;
  if (ratio < 0.5) return "var(--muted-foreground)";
  if (ratio < 0.8) return getColorForFactor(0.45);
  if (ratio <= 1.1) return getColorForFactor(1);
  if (ratio <= 1.3) return "var(--status-warn)";
  return "var(--status-danger)";
}


/**
 * Generische Ampel-Farbe für Zielerreichung (Ist/Soll) – für kcal und alle Makros:
 * 80–110 % → grün, <50 % oder >130 % → rot, dazwischen fließender Gelb/Orange-Übergang.
 */
export function progressFactor(
  current: number | null | undefined,
  target: number | null | undefined,
): number {
  if (!target || target <= 0 || current == null) return 0;
  const ratio = current / target;
  if (ratio <= 0.5) return 0;
  if (ratio < 0.8) return (ratio - 0.5) / 0.3;
  if (ratio <= 1.1) return 1;
  if (ratio < 1.3) return 1 - (ratio - 1.1) / 0.2;
  return 0;
}

export function getColorForProgress(
  current: number | null | undefined,
  target: number | null | undefined,
  fallback = "var(--muted-foreground)",
): string {
  if (!target || target <= 0 || current == null) return fallback;
  return getColorForFactor(progressFactor(current, target));
}
