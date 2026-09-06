// Fixed color mapping for known categories + hash-based fallback for unknown ones.
// Classes are Tailwind utilities; dark mode variants included.
export type CategoryColor = {
  bg: string;
  text: string;
  border: string;
};

export type CategoryGradient = {
  from: string;
  to: string;
  accent: string;
  shadow: string;
};

export const CATEGORY_COLORS: Record<string, CategoryColor> = {
  Frühstück: {
    bg: "bg-amber-100 dark:bg-amber-500/20",
    text: "text-amber-800 dark:text-amber-200",
    border: "border-amber-200 dark:border-amber-500/30",
  },
  Vorspeise: {
    bg: "bg-yellow-100 dark:bg-yellow-500/20",
    text: "text-yellow-800 dark:text-yellow-200",
    border: "border-yellow-200 dark:border-yellow-500/30",
  },
  Hauptgericht: {
    bg: "bg-orange-100 dark:bg-orange-500/20",
    text: "text-orange-800 dark:text-orange-200",
    border: "border-orange-200 dark:border-orange-500/30",
  },
  Dessert: {
    bg: "bg-pink-100 dark:bg-pink-500/20",
    text: "text-pink-800 dark:text-pink-200",
    border: "border-pink-200 dark:border-pink-500/30",
  },
  Vegan: {
    bg: "bg-green-100 dark:bg-green-500/20",
    text: "text-green-800 dark:text-green-200",
    border: "border-green-200 dark:border-green-500/30",
  },
  Vegetarisch: {
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
    text: "text-emerald-800 dark:text-emerald-200",
    border: "border-emerald-200 dark:border-emerald-500/30",
  },
  Snack: {
    bg: "bg-blue-100 dark:bg-blue-500/20",
    text: "text-blue-800 dark:text-blue-200",
    border: "border-blue-200 dark:border-blue-500/30",
  },
  Getränk: {
    bg: "bg-cyan-100 dark:bg-cyan-500/20",
    text: "text-cyan-800 dark:text-cyan-200",
    border: "border-cyan-200 dark:border-cyan-500/30",
  },
  Beilage: {
    bg: "bg-lime-100 dark:bg-lime-500/20",
    text: "text-lime-800 dark:text-lime-200",
    border: "border-lime-200 dark:border-lime-500/30",
  },
  Suppe: {
    bg: "bg-red-100 dark:bg-red-500/20",
    text: "text-red-800 dark:text-red-200",
    border: "border-red-200 dark:border-red-500/30",
  },
  Salat: {
    bg: "bg-teal-100 dark:bg-teal-500/20",
    text: "text-teal-800 dark:text-teal-200",
    border: "border-teal-200 dark:border-teal-500/30",
  },
  Sonstiges: {
    bg: "bg-gray-100 dark:bg-gray-500/20",
    text: "text-gray-800 dark:text-gray-200",
    border: "border-gray-200 dark:border-gray-500/30",
  },
};

const FALLBACK_PALETTE: CategoryColor[] = [
  {
    bg: "bg-violet-100 dark:bg-violet-500/20",
    text: "text-violet-800 dark:text-violet-200",
    border: "border-violet-200 dark:border-violet-500/30",
  },
  {
    bg: "bg-fuchsia-100 dark:bg-fuchsia-500/20",
    text: "text-fuchsia-800 dark:text-fuchsia-200",
    border: "border-fuchsia-200 dark:border-fuchsia-500/30",
  },
  {
    bg: "bg-indigo-100 dark:bg-indigo-500/20",
    text: "text-indigo-800 dark:text-indigo-200",
    border: "border-indigo-200 dark:border-indigo-500/30",
  },
  {
    bg: "bg-sky-100 dark:bg-sky-500/20",
    text: "text-sky-800 dark:text-sky-200",
    border: "border-sky-200 dark:border-sky-500/30",
  },
  {
    bg: "bg-rose-100 dark:bg-rose-500/20",
    text: "text-rose-800 dark:text-rose-200",
    border: "border-rose-200 dark:border-rose-500/30",
  },
  {
    bg: "bg-stone-100 dark:bg-stone-500/20",
    text: "text-stone-800 dark:text-stone-200",
    border: "border-stone-200 dark:border-stone-500/30",
  },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ---- Ingredient categories ----

export const INGREDIENT_CATEGORIES = [
  "Milchprodukte",
  "Fleisch & Fisch",
  "Gemüse",
  "Obst",
  "Getreide & Backwaren",
  "Gewürze & Kräuter",
  "Öle & Fette",
  "Süßungsmittel",
  "Getränke",
  "Supplements",
  "Sonstiges",
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export const DEFAULT_INGREDIENT_CATEGORY: IngredientCategory = "Sonstiges";

// Extend color mapping with ingredient-specific categories.
Object.assign(CATEGORY_COLORS, {
  Milchprodukte: {
    bg: "bg-sky-100 dark:bg-sky-500/20",
    text: "text-sky-800 dark:text-sky-200",
    border: "border-sky-200 dark:border-sky-500/30",
  },
  "Fleisch & Fisch": {
    bg: "bg-red-100 dark:bg-red-500/20",
    text: "text-red-800 dark:text-red-200",
    border: "border-red-200 dark:border-red-500/30",
  },
  Gemüse: {
    bg: "bg-green-100 dark:bg-green-500/20",
    text: "text-green-800 dark:text-green-200",
    border: "border-green-200 dark:border-green-500/30",
  },
  Obst: {
    bg: "bg-pink-100 dark:bg-pink-500/20",
    text: "text-pink-800 dark:text-pink-200",
    border: "border-pink-200 dark:border-pink-500/30",
  },
  "Getreide & Backwaren": {
    bg: "bg-amber-100 dark:bg-amber-500/20",
    text: "text-amber-800 dark:text-amber-200",
    border: "border-amber-200 dark:border-amber-500/30",
  },
  "Gewürze & Kräuter": {
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
    text: "text-emerald-800 dark:text-emerald-200",
    border: "border-emerald-200 dark:border-emerald-500/30",
  },
  "Öle & Fette": {
    bg: "bg-yellow-100 dark:bg-yellow-500/20",
    text: "text-yellow-800 dark:text-yellow-200",
    border: "border-yellow-200 dark:border-yellow-500/30",
  },
  Süßungsmittel: {
    bg: "bg-fuchsia-100 dark:bg-fuchsia-500/20",
    text: "text-fuchsia-800 dark:text-fuchsia-200",
    border: "border-fuchsia-200 dark:border-fuchsia-500/30",
  },
  Getränke: {
    bg: "bg-cyan-100 dark:bg-cyan-500/20",
    text: "text-cyan-800 dark:text-cyan-200",
    border: "border-cyan-200 dark:border-cyan-500/30",
  },
  Supplements: {
    bg: "bg-violet-100 dark:bg-violet-500/20",
    text: "text-violet-800 dark:text-violet-200",
    border: "border-violet-200 dark:border-violet-500/30",
  },
} satisfies Record<string, CategoryColor>);

export function getCategoryColor(name: string): CategoryColor {
  return (
    CATEGORY_COLORS[name] ??
    FALLBACK_PALETTE[hashString(name) % FALLBACK_PALETTE.length]
  );
}

export const CATEGORY_GRADIENTS: Record<string, CategoryGradient> = {
  Frühstück: { from: "#f59e0b", to: "#fbbf24", accent: "#fffbeb", shadow: "rgba(245,158,11,0.35)" },
  Vorspeise: { from: "#eab308", to: "#facc15", accent: "#fefce8", shadow: "rgba(234,179,8,0.35)" },
  Hauptgericht: { from: "#f97316", to: "#fb923c", accent: "#fff7ed", shadow: "rgba(249,115,22,0.35)" },
  Dessert: { from: "#ec4899", to: "#f472b6", accent: "#fdf2f8", shadow: "rgba(236,72,153,0.35)" },
  Vegan: { from: "#22c55e", to: "#4ade80", accent: "#f0fdf4", shadow: "rgba(34,197,94,0.35)" },
  Vegetarisch: { from: "#10b981", to: "#34d399", accent: "#ecfdf5", shadow: "rgba(16,185,129,0.35)" },
  Snack: { from: "#3b82f6", to: "#60a5fa", accent: "#eff6ff", shadow: "rgba(59,130,246,0.35)" },
  Getränk: { from: "#06b6d4", to: "#22d3ee", accent: "#ecfeff", shadow: "rgba(6,182,212,0.35)" },
  Beilage: { from: "#84cc16", to: "#a3e635", accent: "#f7fee7", shadow: "rgba(132,204,22,0.35)" },
  Suppe: { from: "#ef4444", to: "#f87171", accent: "#fef2f2", shadow: "rgba(239,68,68,0.35)" },
  Salat: { from: "#14b8a6", to: "#2dd4bf", accent: "#f0fdfa", shadow: "rgba(20,184,166,0.35)" },
  Sonstiges: { from: "#6b7280", to: "#9ca3af", accent: "#f3f4f6", shadow: "rgba(107,114,128,0.35)" },
  Milchprodukte: { from: "#0ea5e9", to: "#38bdf8", accent: "#f0f9ff", shadow: "rgba(14,165,233,0.35)" },
  "Fleisch & Fisch": { from: "#dc2626", to: "#ef4444", accent: "#fef2f2", shadow: "rgba(220,38,38,0.35)" },
  Gemüse: { from: "#16a34a", to: "#22c55e", accent: "#f0fdf4", shadow: "rgba(22,163,74,0.35)" },
  Obst: { from: "#db2777", to: "#ec4899", accent: "#fdf2f8", shadow: "rgba(219,39,119,0.35)" },
  "Getreide & Backwaren": { from: "#d97706", to: "#f59e0b", accent: "#fffbeb", shadow: "rgba(217,119,6,0.35)" },
  "Gewürze & Kräuter": { from: "#059669", to: "#10b981", accent: "#ecfdf5", shadow: "rgba(5,150,105,0.35)" },
  "Öle & Fette": { from: "#ca8a04", to: "#eab308", accent: "#fefce8", shadow: "rgba(202,138,4,0.35)" },
  Süßungsmittel: { from: "#c026d3", to: "#d946ef", accent: "#fdf4ff", shadow: "rgba(192,38,211,0.35)" },
  Getränke: { from: "#0891b2", to: "#06b6d4", accent: "#ecfeff", shadow: "rgba(8,145,178,0.35)" },
  Supplements: { from: "#7c3aed", to: "#8b5cf6", accent: "#f5f3ff", shadow: "rgba(124,58,237,0.35)" },
};

const FALLBACK_GRADIENTS: CategoryGradient[] = [
  { from: "#8b5cf6", to: "#a78bfa", accent: "#f5f3ff", shadow: "rgba(139,92,246,0.35)" },
  { from: "#d946ef", to: "#e879f9", accent: "#fdf4ff", shadow: "rgba(217,70,239,0.35)" },
  { from: "#6366f1", to: "#818cf8", accent: "#eef2ff", shadow: "rgba(99,102,241,0.35)" },
  { from: "#0ea5e9", to: "#38bdf8", accent: "#f0f9ff", shadow: "rgba(14,165,233,0.35)" },
  { from: "#f43f5e", to: "#fb7185", accent: "#fff1f2", shadow: "rgba(244,63,94,0.35)" },
  { from: "#78716c", to: "#a8a29e", accent: "#fafaf9", shadow: "rgba(120,113,108,0.35)" },
];

export function getCategoryGradient(name: string): CategoryGradient {
  return CATEGORY_GRADIENTS[name] ?? FALLBACK_GRADIENTS[hashString(name) % FALLBACK_GRADIENTS.length];
}

export function groupByCategory<T>(
  items: T[],
  getCategory: (item: T) => string | null | undefined,
  order: readonly string[] = INGREDIENT_CATEGORIES,
): Array<{ category: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const c = getCategory(item) || DEFAULT_INGREDIENT_CATEGORY;
    const arr = map.get(c);
    if (arr) arr.push(item);
    else map.set(c, [item]);
  }
  const known = order.filter((c) => map.has(c));
  const extras = Array.from(map.keys()).filter((c) => !order.includes(c)).sort();
  return [...known, ...extras].map((category) => ({
    category,
    items: map.get(category)!,
  }));
}

