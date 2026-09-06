import {
  Award,
  Circle,
  Crown,
  Diamond,
  Gem,
  Shield,
  Sparkles,
  Star,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export type RankGroup =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "elite"
  | "champion"
  | "unreal";

export type RankTier = {
  /** Eindeutiger Key, z. B. "gold_2". */
  key: string;
  group: RankGroup;
  /** Sub-Stufe (1–3). */
  level: number;
  /** Anzeigename, z. B. "Gold 2". */
  label: string;
  /** Ab dieser Punktzahl gilt der Rang. */
  points: number;
};

export const RANK_GROUP_LABELS: Record<RankGroup, string> = {
  bronze: "Bronze",
  silver: "Silber",
  gold: "Gold",
  platinum: "Platin",
  diamond: "Diamant",
  elite: "Elite",
  champion: "Champion",
  unreal: "Unreal",
};

/** Icon + Farbwerte pro Stufen-Gruppe (Verlauf für das Badge). */
export const RANK_ICONS: Record<
  RankGroup,
  { icon: LucideIcon; from: string; to: string; ring: string; glow: boolean }
> = {
  bronze: {
    icon: Circle,
    from: "#b87333",
    to: "#7a4a1e",
    ring: "#d69a5f",
    glow: false,
  },
  silver: {
    icon: Shield,
    from: "#d8dde3",
    to: "#8a94a1",
    ring: "#eef1f5",
    glow: false,
  },
  gold: { icon: Star, from: "#f5c542", to: "#b8860b", ring: "#ffe38a", glow: false },
  platinum: {
    icon: Gem,
    from: "#a8e6f0",
    to: "#4a90a4",
    ring: "#d6f5fb",
    glow: false,
  },
  diamond: {
    icon: Diamond,
    from: "#7dd3fc",
    to: "#4f46e5",
    ring: "#c7e9ff",
    glow: true,
  },
  elite: { icon: Crown, from: "#c084fc", to: "#6d28d9", ring: "#e9d5ff", glow: true },
  champion: {
    icon: Trophy,
    from: "#fb7185",
    to: "#9f1239",
    ring: "#fecdd3",
    glow: true,
  },
  unreal: {
    icon: Sparkles,
    from: "#a78bfa",
    to: "#38bdf8",
    ring: "#f0abfc",
    glow: true,
  },
};

/** Fallback-Icon für generische Darstellungen. */
export const RANK_FALLBACK_ICON: LucideIcon = Award;

function tier(group: RankGroup, level: number, points: number): RankTier {
  return {
    key: `${group}_${level}`,
    group,
    level,
    label: `${RANK_GROUP_LABELS[group]} ${level}`,
    points,
  };
}

/** Punktgrenzen aller Rang-Stufen, aufsteigend. */
export const RANK_THRESHOLDS: RankTier[] = [
  tier("bronze", 1, 0),
  tier("bronze", 2, 100),
  tier("bronze", 3, 250),
  tier("silver", 1, 450),
  tier("silver", 2, 700),
  tier("silver", 3, 1000),
  tier("gold", 1, 1400),
  tier("gold", 2, 1900),
  tier("gold", 3, 2500),
  tier("platinum", 1, 3200),
  tier("platinum", 2, 4000),
  tier("platinum", 3, 5000),
  tier("diamond", 1, 6200),
  tier("diamond", 2, 7600),
  tier("diamond", 3, 9200),
  tier("elite", 1, 11000),
  tier("elite", 2, 13000),
  tier("elite", 3, 15400),
  tier("champion", 1, 18500),
  tier("champion", 2, 22000),
  tier("champion", 3, 25500),
  tier("unreal", 1, 30000),
  tier("unreal", 2, 33000),
];

export type RankInfo = {
  current: RankTier;
  next: RankTier | null;
  /** Punkte innerhalb der aktuellen Stufe. */
  pointsIntoTier: number;
  /** Punkte, die die aktuelle Stufe umfasst (0 bei höchster Stufe). */
  tierSpan: number;
  /** Fehlende Punkte bis zur nächsten Stufe. */
  pointsToNext: number;
  /** Fortschritt 0–1 innerhalb der aktuellen Stufe. */
  progress: number;
};

/** Ermittelt Rang, nächste Stufe und Fortschritt aus der Punktzahl. */
export function rankForPoints(
  totalPoints: number,
  thresholds: RankTier[] = RANK_THRESHOLDS,
): RankInfo {
  const points = Math.max(0, Math.round(totalPoints));
  let index = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (points >= thresholds[i]!.points) index = i;
  }
  const current = thresholds[index]!;
  const next = thresholds[index + 1] ?? null;
  const pointsIntoTier = points - current.points;
  const tierSpan = next ? next.points - current.points : 0;
  return {
    current,
    next,
    pointsIntoTier,
    tierSpan,
    pointsToNext: next ? next.points - points : 0,
    progress: next ? Math.min(1, pointsIntoTier / Math.max(1, tierSpan)) : 1,
  };
}

/** Season-Rang aus den Punkten der laufenden Season. */
export function seasonRankForPoints(points: number): RankInfo {
  return rankForPoints(points, RANK_THRESHOLDS);
}

/** Rang-Stufe zu einem gespeicherten Key (z. B. aus der Season-Historie). */
export function seasonTierByKey(key: string | null): RankTier {
  return RANK_THRESHOLDS.find((t) => t.key === key) ?? RANK_THRESHOLDS[0]!;
}

import bronze1 from "@/assets/ranks/bronze-1.png";
import bronze2 from "@/assets/ranks/bronze-2.png";
import bronze3 from "@/assets/ranks/bronze-3.png";
import silver1 from "@/assets/ranks/silver-1.png";
import silver2 from "@/assets/ranks/silver-2.png";
import silver3 from "@/assets/ranks/silver-3.png";
import gold1 from "@/assets/ranks/gold-1.png";
import gold2 from "@/assets/ranks/gold-2.png";
import gold3 from "@/assets/ranks/gold-3.png";
import platinum1 from "@/assets/ranks/platinum-1.png";
import platinum2 from "@/assets/ranks/platinum-2.png";
import platinum3 from "@/assets/ranks/platinum-3.png";
import diamond1 from "@/assets/ranks/diamond-1.png";
import diamond2 from "@/assets/ranks/diamond-2.png";
import diamond3 from "@/assets/ranks/diamond-3.png";
import elite1 from "@/assets/ranks/elite-1.png";
import elite2 from "@/assets/ranks/elite-2.png";
import elite3 from "@/assets/ranks/elite-3.png";
import champion1 from "@/assets/ranks/champion-1.png";
import champion2 from "@/assets/ranks/champion-2.png";
import champion3 from "@/assets/ranks/champion-3.png";
import unreal1 from "@/assets/ranks/unreal-1.png";
import unreal2 from "@/assets/ranks/unreal-2.png";


/** Bild-Icon pro Rang-Stufe (Key = RankTier.key). Fehlt ein Bild, greift das Lucide-Fallback. */
export const RANK_IMAGES: Partial<Record<string, string>> = {
  bronze_1: bronze1,
  bronze_2: bronze2,
  bronze_3: bronze3,
  silver_1: silver1,
  silver_2: silver2,
  silver_3: silver3,
  gold_1: gold1,
  gold_2: gold2,
  gold_3: gold3,
  platinum_1: platinum1,
  platinum_2: platinum2,
  platinum_3: platinum3,
  diamond_1: diamond1,
  diamond_2: diamond2,
  diamond_3: diamond3,
  elite_1: elite1,
  elite_2: elite2,
  elite_3: elite3,
  champion_1: champion1,
  champion_2: champion2,
  champion_3: champion3,
  unreal_1: unreal1,
  unreal_2: unreal2,
};
