/** Darstellungs-Einstellung: hell, dunkel oder Systemvorgabe. */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme-preference";

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Hell",
  dark: "Dunkel",
  system: "System",
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/** Lokal gemerkte Auswahl (verhindert Flackern vor dem Profil-Load). */
export function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(raw) ? raw : "system";
}

export function storeTheme(pref: ThemePreference) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, pref);
}

/**
 * Setzt die Theme-Klasse auf <html>. "system" entfernt beide Klassen, damit
 * die prefers-color-scheme-Regeln in src/styles.css greifen.
 */
export function applyTheme(pref: ThemePreference, animate = false) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (animate) {
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 320);
  }
  root.classList.remove("light", "dark");
  if (pref !== "system") root.classList.add(pref);
}

/** Farbvariante des experimentellen Glass-Looks. */
export type GlassVariant = "dark" | "light";

export function isGlassVariant(value: unknown): value is GlassVariant {
  return value === "dark" || value === "light";
}

/**
 * Schaltet den experimentellen Glass-Look app-weit um, in der gewählten
 * Variante (unabhängig von der normalen Hell/Dunkel-Einstellung).
 */
export function applyGlassMode(enabled: boolean, variant: GlassVariant = "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("glass", enabled && variant === "dark");
  root.classList.toggle("glass-light", enabled && variant === "light");
}
