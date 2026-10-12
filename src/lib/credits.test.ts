import { describe, expect, it } from "vitest";
import { CREDIT_MARKUP, formatUsd, tokenCostUsd, usageCostUsd } from "@/lib/credits";

describe("Token-Kosten", () => {
  it("rechnet Sonnet 5.5 mit $2 Eingabe und $10 Ausgabe pro Million", () => {
    const usage = { input_tokens: 6000, output_tokens: 800 };
    expect(tokenCostUsd("claude-sonnet-5-5", usage)).toBeCloseTo(0.012 + 0.008, 8);
  });

  it("schlägt den Aufschlag drauf und rundet auf 6 Stellen", () => {
    const usage = { input_tokens: 6000, output_tokens: 800 };
    expect(usageCostUsd("claude-sonnet-5-5", usage)).toBeCloseTo(0.02 * CREDIT_MARKUP, 6);
  });

  it("nimmt bei unbekanntem Modell den höchsten Preis", () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 0 };
    expect(tokenCostUsd("claude-unbekannt", usage)).toBe(10);
  });
});

describe("formatUsd", () => {
  it("zeigt kleine Beträge mit 3 Nachkommastellen", () => {
    expect(formatUsd(0.0234)).toContain("0,023");
  });

  it("zeigt größere Beträge mit 2 Nachkommastellen", () => {
    expect(formatUsd(6.4)).toContain("6,40");
  });
});
