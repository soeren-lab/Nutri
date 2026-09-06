import { describe, expect, test } from "vitest";
import { mapWithConcurrency } from "@/lib/concurrency";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("mapWithConcurrency", () => {
  test("processes every item exactly once", async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const processed: number[] = [];

    await mapWithConcurrency(items, 4, async (item) => {
      await delay(1);
      processed.push(item);
    });

    expect(processed.slice().sort((a, b) => a - b)).toEqual(items);
  });

  test("never runs more than `limit` workers at once", async () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    let active = 0;
    let maxActive = 0;

    await mapWithConcurrency(items, 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active--;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(0);
  });

  test("one item's rejection does not stop the others from completing", async () => {
    const items = [1, 2, 3, 4, 5];
    const processed: number[] = [];

    await mapWithConcurrency(items, 2, async (item) => {
      if (item === 3) throw new Error("boom");
      await delay(1);
      processed.push(item);
    });

    expect(processed.slice().sort((a, b) => a - b)).toEqual([1, 2, 4, 5]);
  });
});
