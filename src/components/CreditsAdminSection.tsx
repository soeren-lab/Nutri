import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminTopup,
  creditLedgerQuery,
  creditOverviewQuery,
  formatUsd,
  LEDGER_KIND_LABELS,
} from "@/lib/credits";
import { cn } from "@/lib/utils";

type OverviewRow = NonNullable<ReturnType<typeof useOverview>["data"]>[number];

function useOverview() {
  return useQuery(creditOverviewQuery());
}

function TopupDialog({ row, onClose }: { row: OverviewRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [correction, setCorrection] = useState(false);
  const value = Number(amount.replace(",", "."));
  const valid = Number.isFinite(value) && value !== 0 && (correction || value > 0);

  const mutation = useMutation({
    mutationFn: () =>
      adminTopup({
        userId: row.user_id,
        amountUsd: value,
        note: note.trim() || undefined,
        kind: correction ? "adjustment" : "topup",
      }),
    onSuccess: (balance) => {
      void qc.invalidateQueries({ queryKey: ["credit-overview"] });
      void qc.invalidateQueries({ queryKey: ["credit-ledger"] });
      void qc.invalidateQueries({ queryKey: ["credits-balance"] });
      toast.success(`Gebucht. Neues Guthaben: ${formatUsd(balance)}`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="truncate">{row.username ?? row.email ?? "User"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="tp-amount">
            {correction ? "Korrekturbetrag in US-Dollar (± erlaubt)" : "Aufladung in US-Dollar"}
          </Label>
          <Input
            id="tp-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tp-note">Notiz (optional)</Label>
          <Input
            id="tp-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z. B. Überweisung 14.10."
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={correction}
            onChange={(e) => setCorrection(e.target.checked)}
          />
          Als Korrektur buchen (auch negativ möglich)
        </label>
        <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
          Buchen
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function UserLedger({ userId }: { userId: string }) {
  const { data = [] } = useQuery(creditLedgerQuery(userId, 20));
  if (data.length === 0) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">Noch keine Buchungen.</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-xl bg-muted/40 px-3">
      {data.map((r) => {
        const amount = Number(r.amount_usd);
        return (
          <li key={r.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
            <span className="min-w-0 truncate">
              {LEDGER_KIND_LABELS[r.kind] ?? r.kind}
              {r.note ? ` · ${r.note}` : ""} ·{" "}
              {new Date(r.created_at).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
            <span className={cn("shrink-0 tabular-nums", amount >= 0 && "text-primary")}>
              {amount >= 0 ? "+" : ""}
              {formatUsd(amount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Admin: Guthaben aller User, Verbrauch, Aufladen und Verlauf. */
export function CreditsAdminSection() {
  const { data = [], isLoading, error } = useOverview();
  const [topup, setTopup] = useState<OverviewRow | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const totals = data.reduce(
    (acc, r) => ({
      balance: acc.balance + Number(r.balance_usd),
      topped: acc.topped + Number(r.topped_up_usd),
      used: acc.used + Number(r.used_usd),
      scans: acc.scans + Number(r.scans),
    }),
    { balance: 0, topped: 0, used: 0, scans: 0 },
  );

  if (error) {
    return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Offenes Guthaben", formatUsd(totals.balance)],
          ["Aufgeladen", formatUsd(totals.topped)],
          ["Verbraucht", formatUsd(totals.used)],
          ["Scans", String(totals.scans)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="text-base font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-2">
        {isLoading ? (
          <p className="p-3 text-sm text-muted-foreground">Lädt…</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((r) => {
              const balance = Number(r.balance_usd);
              const expanded = open === r.user_id;
              return (
                <li key={r.user_id} className="space-y-2 p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.username ?? r.email ?? r.user_id}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {r.email}
                        {Number(r.scans) > 0 &&
                          ` · ${r.scans} Scans · verbraucht ${formatUsd(Number(r.used_usd))}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          balance <= 0 && "text-destructive",
                        )}
                      >
                        {formatUsd(balance)}
                      </p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        geladen {formatUsd(Number(r.topped_up_usd))}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setTopup(r)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Aufladen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpen(expanded ? null : r.user_id)}
                    >
                      Verlauf
                      <ChevronDown
                        className={cn(
                          "ml-1 h-3.5 w-3.5 transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    </Button>
                  </div>
                  {expanded && <UserLedger userId={r.user_id} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {topup && <TopupDialog row={topup} onClose={() => setTopup(null)} />}
    </div>
  );
}
