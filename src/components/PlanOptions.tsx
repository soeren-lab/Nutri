import { Check, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CURRENT_PLAN, type PlanId } from "@/lib/plans";

type PlanDef = {
  id: PlanId;
  name: string;
  price: string;
  tagline: string;
  features: readonly string[];
};

const PLANS: readonly PlanDef[] = [
  {
    id: "free",
    name: "Free",
    price: "0 €/Monat",
    tagline: "Alle Basis-Funktionen",
    features: [
      "Rezepte & Planer",
      "Community-Zugriff",
      "Bis zu 3 KI-Vorschläge/Woche",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "4,99 €/Monat",
    tagline: "Für ambitionierte Tracker",
    features: [
      "KI-gestützter Wochenplaner",
      "Unbegrenzte Rezepte & Kochbücher",
      "Keine Werbung",
      "Erweiterte Statistiken",
    ],
  },
  {
    id: "max",
    name: "Max",
    price: "9,99 €/Monat",
    tagline: "Alles aus Pro – und mehr",
    features: [
      "Alle Pro-Vorteile",
      "Unbegrenzte KI-Vorschläge",
      "Prioritäts-Support",
      "Frühzugriff auf neue Features",
    ],
  },
];

/** Drei Plan-Stufen als vertikal gestapelte Cards (Mobile-First). */
export function PlanOptions() {
  return (
    <div className="space-y-4">
      {PLANS.map((plan) => (
        <PlanCard key={plan.id} plan={plan} current={plan.id === CURRENT_PLAN} />
      ))}
      <p className="px-1 text-center text-[11px] text-muted-foreground">
        Preise sind Platzhalter. Zahlungen sind noch nicht aktiv.
      </p>
    </div>
  );
}

function PlanCard({ plan, current }: { plan: PlanDef; current: boolean }) {
  const isFree = plan.id === "free";
  const isMax = plan.id === "max";

  return (
    <section
      className={
        isFree
          ? "relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-[var(--shadow-card)]"
          : isMax
            ? "relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-primary to-fuchsia-600 p-5 text-primary-foreground shadow-[0_22px_50px_-18px_color-mix(in_oklab,var(--primary)_80%,transparent)]"
            : "relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-indigo-600 p-5 text-primary-foreground shadow-[0_18px_40px_-18px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
      }
    >
      {!isFree && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-white/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20"
          />
        </>
      )}
      {isMax && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-14 -bottom-20 h-56 w-56 rounded-full bg-amber-300/40 blur-3xl"
        />
      )}

      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              {isMax && <Crown className="h-4 w-4 text-amber-200" />}
              <h3 className="text-2xl font-bold tracking-tight">{plan.name}</h3>
            </div>
            <p
              className={
                isFree
                  ? "text-xs text-muted-foreground"
                  : "text-xs text-primary-foreground/75"
              }
            >
              {plan.tagline}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{plan.price}</p>
            {current && (
              <span
                className={
                  isFree
                    ? "mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    : "mt-1 inline-block rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                }
              >
                Aktueller Plan
              </span>
            )}
          </div>
        </div>

        <ul className="space-y-2">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <span
                className={
                  isFree
                    ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10"
                    : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/25"
                }
              >
                <Check
                  className={isFree ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5"}
                  strokeWidth={3}
                />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {current ? null : isFree ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => toast.info("Bald verfügbar")}
          >
            Auf Free wechseln
          </Button>
        ) : (
          <Button
            className="w-full bg-white font-semibold text-primary shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-xl hover:shadow-black/25 active:translate-y-0"
            onClick={() => toast.info("Bald verfügbar")}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Upgrade auf {plan.name}
          </Button>
        )}
      </div>
    </section>
  );
}
