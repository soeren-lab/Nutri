import { describe, expect, it } from "vitest";
import { cleanBarcode, isValidBarcode } from "@/lib/barcode";

describe("Barcode", () => {
  it("akzeptiert EAN-13, EAN-8 und UPC-A", () => {
    expect(isValidBarcode("4006381333931")).toBe(true);
    expect(isValidBarcode("96385074")).toBe(true);
    expect(isValidBarcode("036000291452")).toBe(true);
  });

  it("lehnt zu kurze, zu lange und nicht-numerische Codes ab", () => {
    expect(isValidBarcode("1234567")).toBe(false);
    expect(isValidBarcode("123456789012345")).toBe(false);
    expect(isValidBarcode("40063813339a1")).toBe(false);
    expect(isValidBarcode("")).toBe(false);
  });

  it("entfernt Leerzeichen und Bindestriche", () => {
    expect(cleanBarcode(" 4006 3813-33931 ")).toBe("4006381333931");
  });
});
