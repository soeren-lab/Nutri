import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MutationObserver, QueryClient, onlineManager } from "@tanstack/react-query";

// In-Memory-Ersatz für IndexedDB (idb-keyval): überlebt den "Neustart" (neuer QueryClient).
const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => void store.set(k, v),
  del: async (k: string) => void store.delete(k),
}));

const addFoodEntry = vi.fn(async (_input: unknown) => ({ id: "server-1" }));
vi.mock("@/lib/meal-plan", async () => {
  const actual = await vi.importActual<typeof import("@/lib/meal-plan")>("@/lib/meal-plan");
  return { ...actual, addFoodEntry: (input: unknown) => addFoodEntry(input) };
});
vi.mock("@/lib/auth-session", () => ({ currentUserId: async () => "user-1" }));
vi.mock("@/lib/offline-sync", () => ({ warmOfflineCache: vi.fn(async () => {}) }));
vi.mock("@/integrations/db/client", () => ({ db: {} }));

let probeResult = true;
vi.mock("@/lib/db-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db-client")>("@/lib/db-client");
  return { ...actual, probeApi: async () => probeResult };
});

import { markApiUp, setOsOnline, takeOverOnlineManager } from "@/lib/api-reachability";
import { MUTATION_KEYS, registerOfflineMutationDefaults } from "@/lib/offline-mutations";
import { setupOfflinePersistence } from "@/lib/offline-persistence";

const NETWORK_ERROR = { message: "Der Server ist nicht erreichbar.", code: "network" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", {});
  takeOverOnlineManager();
  store.clear();
  addFoodEntry.mockClear();
  probeResult = true;
  setOsOnline(true);
  markApiUp(true);
});

afterEach(() => {
  markApiUp(true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function newClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  registerOfflineMutationDefaults(qc);
  return qc;
}

describe("Offline eintragen, App neu öffnen", () => {
  test("vorgemerkte Änderung wird nach dem Neustart gesendet, sobald die NAS antwortet", async () => {
    // --- Sitzung 1: NAS nicht erreichbar, Nutzer trägt etwas ein ---
    const qc1 = newClient();
    qc1.mount();
    await setupOfflinePersistence(qc1);
    addFoodEntry.mockImplementation(async () => {
      markApiUp(false);
      throw NETWORK_ERROR;
    });
    const obs = new MutationObserver<unknown, unknown, Record<string, unknown>>(qc1, {
      mutationKey: MUTATION_KEYS.planFood,
    });
    void obs
      .mutate({
        date: new Date("2026-10-21T00:00:00Z"),
        slot: "Frühstück",
        ingredientId: "ing-1",
        amount: 100,
        unit: "g",
      })
      .catch(() => {});
    await vi.advanceTimersByTimeAsync(3000); // Wiederholung + Speichern (1 s Drosselung)
    expect(onlineManager.isOnline()).toBe(false);
    expect(qc1.getMutationCache().getAll()[0]?.state.isPaused).toBe(true);
    expect(addFoodEntry).toHaveBeenCalledTimes(1);

    // gespeichert?
    const saved = JSON.stringify(store.get("nutri-offline-cache") ?? "");
    expect(saved).toContain("plan-food");
    qc1.unmount();

    // --- Sitzung 2: App neu geöffnet, NAS erreichbar ---
    // Der alte Client lebt im Test noch (in der echten App gibt es nur einen): sein Aufruf zählt nicht.
    addFoodEntry.mockClear();
    addFoodEntry.mockImplementation(async () => ({ id: "server-1" })); // NAS antwortet wieder
    const qc2 = newClient();
    qc2.mount();
    await setupOfflinePersistence(qc2);
    markApiUp(true);
    await vi.advanceTimersByTimeAsync(3000);

    const restored = qc2.getMutationCache().getAll();
    expect(restored).toHaveLength(1);
    expect(restored[0]?.state.status).toBe("success"); // wurde in Sitzung 2 gesendet
    expect(addFoodEntry.mock.calls.at(-1)?.[0]).toMatchObject({
      userId: "user-1",
      date: "2026-10-21",
      ingredient_master_id: "ing-1",
      amount: 100,
    });
  });

  test("vorgemerkte Änderung wird sofort gesichert, nicht erst nach der Drosselung (App wird gleich geschlossen)", async () => {
    const qc = newClient();
    qc.mount();
    await setupOfflinePersistence(qc);
    markApiUp(false); // NAS nicht erreichbar -> Änderung wird sofort pausiert
    const obs = new MutationObserver<unknown, unknown, Record<string, unknown>>(qc, {
      mutationKey: MUTATION_KEYS.planFood,
    });
    void obs
      .mutate({
        date: new Date("2026-10-21T00:00:00Z"),
        slot: "Mittag",
        ingredientId: "ing-2",
        amount: 50,
        unit: "g",
      })
      .catch(() => {});
    await vi.advanceTimersByTimeAsync(100); // weit unter der 1-s-Drosselung des normalen Speicherns
    expect(JSON.stringify(store.get("nutri-offline-cache") ?? "")).toContain("plan-food");
  });
});
