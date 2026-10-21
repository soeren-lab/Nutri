import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UNREACHABLE_MESSAGE, getApiBase, resolveApiBase } from "@/lib/db-client";

/** Zeigt eine klare Meldung, wenn die NAS-API nicht erreichbar ist (statt leerer Bildschirme). */
export function ApiStatusBanner() {
  const qc = useQueryClient();
  const [down, setDown] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const onDown = () => setDown(true);
    window.addEventListener("api-unreachable", onDown);
    return () => window.removeEventListener("api-unreachable", onDown);
  }, []);

  const retry = useCallback(async () => {
    setChecking(true);
    try {
      await resolveApiBase(true);
      const base = getApiBase();
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        setDown(false);
        void qc.invalidateQueries();
      }
    } catch {
      /* weiterhin nicht erreichbar */
    } finally {
      setChecking(false);
    }
  }, [qc]);

  // Solange der Server fehlt, alle 15 s selbst nachsehen.
  useEffect(() => {
    if (!down) return;
    const t = setInterval(() => void retry(), 15000);
    return () => clearInterval(t);
  }, [down, retry]);

  if (!down) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] flex items-center gap-3 bg-destructive px-4 py-2 text-sm text-destructive-foreground"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{UNREACHABLE_MESSAGE}</span>
      <Button size="sm" variant="secondary" disabled={checking} onClick={() => void retry()}>
        Erneut prüfen
      </Button>
    </div>
  );
}
