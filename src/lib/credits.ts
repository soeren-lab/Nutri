import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/** Aufschlag auf die reinen Token-Kosten (Speicher, Hosting, Fehlversuche). */
export const CREDIT_MARKUP = 1.2;

/** Preise in US-Dollar pro 1 Mio. Tokens (Stand Anthropic-Preisliste, Oktober 2026). */
export const MODEL_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-fable-5-1": { input: 10, output: 50 },
};

/** Unbekanntes Modell: sicherheitshalber der höchste Preis, damit nie zu wenig abgebucht wird. */
const FALLBACK_PRICE = { input: 10, output: 50 };

export type TokenUsage = { input_tokens: number; output_tokens: number };

/** Reine Token-Kosten ohne Aufschlag. */
export function tokenCostUsd(model: string, usage: TokenUsage): number {
  const price = MODEL_PRICES_USD_PER_MTOK[model] ?? FALLBACK_PRICE;
  return (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1_000_000;
}

/** Abzubuchender Betrag inklusive Aufschlag, auf 6 Nachkommastellen gerundet. */
export function usageCostUsd(model: string, usage: TokenUsage): number {
  return Math.round(tokenCostUsd(model, usage) * CREDIT_MARKUP * 1_000_000) / 1_000_000;
}

/** Dollar-Betrag für die Anzeige (kleine Beträge mit 3 Nachkommastellen). */
export function formatUsd(value: number): string {
  const digits = Math.abs(value) < 1 ? 3 : 2;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
}

export type CreditLedgerRow = Tables<"credit_ledger">;

export const LEDGER_KIND_LABELS: Record<string, string> = {
  topup: "Aufladung",
  usage: "Foto-Scan",
  adjustment: "Korrektur",
};

/** Eigenes Guthaben; ohne Zeile ist es 0. */
export const creditBalanceQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["credits-balance", userId ?? "anon"],
    enabled: !!userId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("user_credits")
        .select("balance_usd")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.balance_usd ?? 0);
    },
  });

/** Verlauf (neueste zuerst); Admins können mit `userId` fremde Verläufe lesen. */
export const creditLedgerQuery = (userId: string | undefined, limit = 100) =>
  queryOptions({
    queryKey: ["credit-ledger", userId ?? "anon", limit],
    enabled: !!userId,
    queryFn: async (): Promise<CreditLedgerRow[]> => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });

export const creditOverviewQuery = () =>
  queryOptions({
    queryKey: ["credit-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_credit_overview");
      if (error) throw error;
      return data ?? [];
    },
  });

export async function adminTopup(input: {
  userId: string;
  amountUsd: number;
  note?: string;
  kind?: "topup" | "adjustment";
}): Promise<number> {
  const { data, error } = await supabase.rpc("admin_credit_topup", {
    _user_id: input.userId,
    _amount_usd: input.amountUsd,
    _note: input.note,
    _kind: input.kind ?? "topup",
  });
  if (error) throw error;
  return Number(data);
}
