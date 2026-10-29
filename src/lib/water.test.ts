import { describe, expect, test } from "vitest";
import { formatWater, totalWaterMl } from "@/lib/water";

describe("Wasser", () => {
  test("Summe aller Einträge", () => {
    expect(totalWaterMl([])).toBe(0);
    expect(totalWaterMl([{ amount_ml: 250 }, { amount_ml: 500 }])).toBe(750);
  });

  test("Anzeige in ml und Litern", () => {
    expect(formatWater(0)).toBe("0 ml");
    expect(formatWater(750)).toBe("750 ml");
    expect(formatWater(1000)).toBe("1 l");
    expect(formatWater(1250)).toBe("1,25 l");
    expect(formatWater(2500)).toBe("2,5 l");
  });
});
