import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/** Platzhalter-Seite für rechtliche Inhalte. */
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-lg space-y-6 p-4">
      <Link
        to="/profile"
        search={{ tab: "admin" as const }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Wird noch ergänzt.</p>
      </section>
      {children}
    </main>
  );
}

/** Pflicht-Attribution für importierte Lebensmitteldaten. */
export function OpenFoodFactsAttribution() {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Datenquellen</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Teile der Lebensmitteldaten stammen von Open Food Facts (
        <a
          href="https://openfoodfacts.org"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          openfoodfacts.org
        </a>
        ), lizenziert unter der Open Database License (ODbL).
      </p>
    </section>
  );
}
