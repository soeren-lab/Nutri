import { AlertTriangle, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasFailedSync, useOnlineStatus, usePendingSyncCount } from "@/hooks/use-online-status";
import { recheckApi } from "@/lib/api-reachability";

/**
 * Dezenter Hinweis statt Sperre: Alles bleibt offline nutzbar, Änderungen werden lokal vorgemerkt
 * und an die NAS gesendet, sobald sie wieder erreichbar ist. "Offline" heißt hier: die NAS
 * antwortet nicht (Heimnetz/Tailscale), nicht nur "kein Internet".
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const pending = usePendingSyncCount();
  const hasFailedSync = useHasFailedSync();

  if (isOnline && hasFailedSync) {
    return (
      <div className="flex items-center justify-center gap-2 bg-destructive/15 px-4 py-1.5 text-center text-xs font-medium text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Synchronisierung fehlgeschlagen – bitte die Änderung erneut vornehmen.
      </div>
    );
  }

  if (isOnline && pending === 0) return null;

  const waiting = pending === 1 ? "1 Änderung wartet" : `${pending} Änderungen warten`;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0">
        {isOnline
          ? "Änderungen werden gesendet …"
          : `Offline – NAS nicht erreichbar.${pending > 0 ? ` ${waiting} auf das Senden.` : " Änderungen werden vorgemerkt und gesendet, sobald sie wieder erreichbar ist."}`}
      </span>
      {!isOnline && (
        <Button
          size="sm"
          variant="outline"
          className="h-6 shrink-0 px-2 text-[11px]"
          onClick={() => void recheckApi()}
        >
          Erneut prüfen
        </Button>
      )}
    </div>
  );
}
