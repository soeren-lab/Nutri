import { Style, StatusBar } from "@capacitor/status-bar";
import { isNativeApp } from "@/lib/platform";

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
  void syncStatusBarIconStyle();
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
  void syncStatusBarIconStyle();
}

/**
 * Bestimmt aus den bereits gesetzten Klassen (siehe applyTheme/applyGlassMode
 * oben), ob die App gerade hell oder dunkel aussieht – ".glass"/".glass-light"
 * überstimmen dabei bewusst die normale Hell/Dunkel-Einstellung, genau wie es
 * auch optisch in src/styles.css passiert.
 */
function resolvedIsDark(): boolean {
  const root = document.documentElement;
  if (root.classList.contains("glass")) return true;
  if (root.classList.contains("glass-light")) return false;
  if (root.classList.contains("dark")) return true;
  if (root.classList.contains("light")) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Android setzt die Status-Bar-Symbole (Uhrzeit, Akku, ...) standardmäßig
 * fest auf Weiß, unabhängig von unserer In-App-Theme-Wahl – das native Fenster
 * kennt unsere .glass/.glass-light-Klassen nicht. Ohne diesen Sync werden die
 * weißen Symbole im hellen Glass-Header unsichtbar.
 *
 * Capacitors Style-Namen sind gegenläufig zur Wirkung benannt (per Plugin-
 * Typdefinition): Style.Dark = "Light text for dark backgrounds" (helle
 * Symbole für dunklen Hintergrund), Style.Light = "Dark text for light
 * backgrounds" (dunkle Symbole für hellen Hintergrund) – NICHT "Style.Dark
 * macht die Symbole dunkel". Vorher genau andersherum verdrahtet gewesen.
 */
async function syncStatusBarIconStyle() {
  if (!isNativeApp()) return;
  try {
    await StatusBar.setStyle({ style: resolvedIsDark() ? Style.Dark : Style.Light });
  } catch {
    // Plugin auf diesem Gerät/Build nicht verfügbar – ignorieren.
  }
}
