import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  creditBalanceQuery,
  creditLedgerQuery,
  formatUsd,
  LEDGER_KIND_LABELS,
  CREDIT_MARKUP,
} from "@/lib/credits";
import { cn } from "@/lib/utils";

/** Eigenes Guthaben für den Foto-Scan inklusive Verlauf. */
export function CreditsSection() {
  const { user } = useAuth();
  const { data: balance, isLoading } = useQuery(creditBalanceQuery(user?.id));
  const { data: ledger = [] } = useQuery(creditLedgerQuery(user?.id));
  const low = balance != null && balance <= 0;

  return (
    <div className="space-y-4">
      <section className="space-y-1 rounded-2xl border border-border bg-card p-4 text-center">
        <p className="text-xs text-muted-foreground">Dein Guthaben</p>
        <p className={cn("text-3xl font-semibold tabular-nums", low && "text-destructive")}>
          {isLoading || balance == null ? "…" : formatUsd(balance)}
        </p>
        <p className="text-xs text-muted-foreground">
          {low
            ? "Guthaben muss aufgeladen werden, bevor du weiter scannen kannst."
            : "Jeder Foto-Scan bucht seine tatsächlichen KI-Kosten ab."}
        </p>
      </section>

      <p className="px-1 text-[11px] text-muted-foreground">
        Abgerechnet werden die echten Token-Kosten der KI plus{" "}
        {Math.round((CREDIT_MARKUP - 1) * 100)} % Aufschlag für Speicher und Hosting. Aufladen
        kannst du beim Entwickler (per Überweisung), er schreibt dir den Betrag gut.
      </p>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Verlauf</p>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Buchungen.</p>
        ) : (
          <ul className="divide-y divide-border">
            {ledger.map((row) => {
              const amount = Number(row.amount_usd);
              return (
                <li key={row.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {LEDGER_KIND_LABELS[row.kind] ?? row.kind}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(row.created_at).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {row.kind === "usage" &&
                        row.input_tokens != null &&
                        ` · ${row.input_tokens + (row.output_tokens ?? 0)} Tokens`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-sm font-medium tabular-nums",
                        amount >= 0 ? "text-primary" : "text-foreground",
                      )}
                    >
                      {amount >= 0 ? "+" : ""}
                      {formatUsd(amount)}
                    </p>
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      Stand {formatUsd(Number(row.balance_after_usd))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
