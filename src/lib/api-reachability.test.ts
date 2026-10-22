import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MutationObserver, QueryClient, onlineManager } from "@tanstack/react-query";
import { markApiUp, setApiProbe, setOsOnline, takeOverOnlineManager } from "@/lib/api-reachability";

const NETWORK_ERROR = { message: "Der Server ist nicht erreichbar.", code: "network" };
const isNetworkError = (e: unknown) => (e as { code?: string } | null)?.code === "network";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", {});
  takeOverOnlineManager();
  setApiProbe(async () => false);
  setOsOnline(true);
  markApiUp(true);
});

afterEach(() => {
  markApiUp(true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Online-Status = NAS erreichbar", () => {
  test("Android online, NAS nicht erreichbar -> App ist offline", () => {
    setOsOnline(true);
    markApiUp(false);
    expect(onlineManager.isOnline()).toBe(false);
  });

  test("NAS wieder erreichbar -> online, aber nur wenn auch das Netz da ist", () => {
    setOsOnline(false);
    markApiUp(false);
    markApiUp(true);
    expect(onlineManager.isOnline()).toBe(false); // OS noch offline
    setOsOnline(true);
    expect(onlineManager.isOnline()).toBe(true);
  });

  test("solange die NAS fehlt, wird regelmäßig geprüft und bei Antwort wieder online", async () => {
    let reachable = false;
    setApiProbe(async () => reachable);
    markApiUp(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(onlineManager.isOnline()).toBe(false);
    reachable = true;
    await vi.advanceTimersByTimeAsync(5000);
    expect(onlineManager.isOnline()).toBe(true);
  });
});

describe("Änderungen gehen offline nicht verloren", () => {
  test("Netzfehler -> Änderung wird pausiert und nach dem Wiedererreichen genau einmal gesendet", async () => {
    const qc = new QueryClient();
    qc.mount();
    const sent: string[] = [];
    let nasReachable = false;
    qc.setMutationDefaults(["add"], {
      retry: (_count: number, error: unknown) => isNetworkError(error),
      retryDelay: 100,
      mutationFn: async (name: string) => {
        if (!nasReachable) {
          markApiUp(false); // so merkt die App: Anfrage gescheitert
          throw NETWORK_ERROR;
        }
        sent.push(name);
        return name;
      },
    });

    const observer = new MutationObserver<string, unknown, string>(qc, { mutationKey: ["add"] });
    const done = observer.mutate("Frühstück");
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toEqual([]); // nichts gesendet, aber auch nicht verworfen
    expect(qc.getMutationCache().getAll()[0]?.state.isPaused).toBe(true);

    nasReachable = true;
    markApiUp(true);
    await vi.advanceTimersByTimeAsync(500);
    await done;
    expect(sent).toEqual(["Frühstück"]);
  });

  test("echte Fehler (kein Netzfehler) werden nicht endlos wiederholt", async () => {
    const qc = new QueryClient();
    qc.mount();
    let calls = 0;
    qc.setMutationDefaults(["add"], {
      retry: (_count: number, error: unknown) => isNetworkError(error),
      retryDelay: 100,
      mutationFn: async () => {
        calls++;
        throw new Error("Ungültige Eingabe");
      },
    });
    const observer = new MutationObserver<string, unknown, string>(qc, { mutationKey: ["add"] });
    await expect(observer.mutate("x")).rejects.toThrow("Ungültige Eingabe");
    expect(calls).toBe(1);
  });
});
