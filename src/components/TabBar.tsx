import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  Carrot,
  Compass,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TabItem = {
  label: string;
  icon: LucideIcon;
  to: string;
  /** Hervorgehobener Mittelknopf (Startseite). */
  primary?: boolean;
};

/**
 * Reihenfolge von links nach rechts: erst die Bausteine zum Planen (Rezepte, Zutaten), in der
 * Mitte der Planer (Startseite), dann was daraus folgt (Einkauf), ganz rechts der Online-Teil
 * (Entdecken). Das Profil bleibt bewusst oben im Header. Die Wisch-Reihenfolge steht in
 * routes/_authenticated/route.tsx (SWIPE_TAB_ORDER) und muss dazu passen.
 */
export const TABS: TabItem[] = [
  { label: "Rezepte", icon: BookOpen, to: "/recipes" },
  { label: "Zutaten", icon: Carrot, to: "/ingredients" },
  { label: "Planer", icon: CalendarDays, to: "/planner", primary: true },
  { label: "Einkauf", icon: ShoppingCart, to: "/shopping-list" },
  { label: "Entdecken", icon: Compass, to: "/discover" },
];

export function TabBar() {
  return (
    <nav
      aria-label="Hauptnavigation"
      // "tab-bar": Liquid-Glass-Übersteuerung (siehe styles.css) auf den
      // Haupttab-Seiten – Verlauf statt Transluzenz+Blur.
      className="tab-bar fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-end justify-around gap-1 px-2 py-1.5">
        {TABS.map((tab) =>
          tab.primary ? (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                aria-label={tab.label}
                className={cn(
                  "group relative z-10 flex flex-col items-center justify-end gap-0.5 px-1 pb-1 text-[10px] font-semibold text-muted-foreground transition-colors",
                  // Ring um den Mittelknopf zeigt, dass der Planer gerade offen ist.
                  "[&_.tab-center-disc]:ring-background",
                )}
                activeProps={{
                  className:
                    "group relative z-10 flex flex-col items-center justify-end gap-0.5 px-1 pb-1 text-[10px] font-semibold text-primary [&_.tab-center-disc]:ring-primary",
                }}
              >
                <span
                  className="tab-center-disc relative z-10 -mt-7 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg ring-4 transition-transform group-active:scale-95"
                  style={{ background: "var(--primary-gradient)" }}
                >
                  <tab.icon className="h-6 w-6" />
                </span>
                <span className="relative top-1.5 leading-none">{tab.label}</span>
              </Link>
            </li>
          ) : (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                )}
                activeProps={{
                  // "tab-active": Marker für die Liquid-Glass-Übersteuerung
                  // (gefüllte Verlaufs-Pille statt leichtem Farbton).
                  className:
                    "tab-active flex flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 text-[10px] font-medium bg-gradient-to-br from-primary/10 to-accent/10 text-primary",
                }}
              >
                <tab.icon className="h-5 w-5" />
                <span className="leading-none">{tab.label}</span>
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
