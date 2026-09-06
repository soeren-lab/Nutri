import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/** Rahmen für eine Verwaltung-Unterseite mit Zurück-Pfeil. */
export function SettingsSubPage({
  title,
  description,
  backTab = "admin",
  children,
}: {
  title: string;
  description?: string;
  backTab?: "admin" | "goals" | "progress";
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link
        to="/profile"
        search={{ tab: backTab }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}
