import { describe, expect, it } from "vitest";
import { describePlate, plateInfoSchema } from "@/lib/plates";

describe("describePlate", () => {
  it("beschreibt runde Teller mit Durchmesser und Tiefe", () => {
    expect(describePlate({ name: "A", shape: "round", width_cm: 26, depth_cm: 3 })).toBe(
      "Teller (rund), Durchmesser 26 cm, Tiefe 3 cm",
    );
  });

  it("beschreibt ovale Teller mit Breite × Länge", () => {
    expect(
      describePlate({ name: "B", shape: "oval", width_cm: 22, length_cm: 30.5, depth_cm: 2.5 }),
    ).toBe("Teller (oval/eckig), 22 × 30,5 cm, Tiefe 2,5 cm");
  });

  it("nennt bei Schüsseln das Fassungsvermögen", () => {
    expect(
      describePlate({ name: "C", shape: "bowl", width_cm: 16, depth_cm: 7, capacity_ml: 600 }),
    ).toBe("Schüssel, Durchmesser 16 cm, Tiefe 7 cm, Fassungsvermögen 600 ml");
  });
});

describe("plateInfoSchema", () => {
  it("lehnt unrealistische Maße ab", () => {
    expect(
      plateInfoSchema.safeParse({ name: "X", shape: "round", width_cm: 500, depth_cm: 3 }).success,
    ).toBe(false);
    expect(
      plateInfoSchema.safeParse({ name: "X", shape: "round", width_cm: 26, depth_cm: 0 }).success,
    ).toBe(false);
  });
});
