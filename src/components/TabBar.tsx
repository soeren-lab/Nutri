import { Link } from "@tanstack/react-router";
import { BookOpen, CalendarDays, Carrot, Library, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabItem = {
  label: string;
  icon: LucideIcon;
  to: string;
};

export const TABS: TabItem[] = [
  { label: "Rezepte", icon: BookOpen, to: "/recipes" },
  { label: "Kochbücher", icon: Library, to: "/cookbooks" },
  { label: "Zutaten", icon: Carrot, to: "/ingredients" },
  { label: "Planer", icon: CalendarDays, to: "/planner" },
];


export function TabBar() {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around gap-1 px-2 py-1.5">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <Link
              to={tab.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground",
              )}
              activeProps={{
                className:
                  "flex flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 text-[10px] font-medium bg-gradient-to-br from-primary/10 to-accent/10 text-primary",
              }}

            >
              <tab.icon className="h-5 w-5" />
              <span className="leading-none">{tab.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
