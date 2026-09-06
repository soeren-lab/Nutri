import { AlertTriangle, WifiOff } from "lucide-react";
import { useHasFailedSync, useHasPendingSync, useOnlineStatus } from "@/hooks/use-online-status";

/**
 * Dezenter Hinweis statt Sperre: Rezepte/Zutaten/Planer bleiben offline
 * nutzbar, Änderungen werden lokal gespeichert und synchronisiert, sobald
 * wieder eine Verbindung besteht.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const hasPendingSync = useHasPendingSync();
  const hasFailedSync = useHasFailedSync();

  if (isOnline && hasFailedSync) {
    return (
      <div className="flex items-center justify-center gap-2 bg-destructive/15 px-4 py-1.5 text-center text-xs font-medium text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Synchronisierung fehlgeschlagen – bitte die Änderung erneut vornehmen.
      </div>
    );
  }

  if (isOnline && !hasPendingSync) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      {isOnline
        ? "Änderungen werden synchronisiert …"
        : "Offline – Änderungen werden gespeichert und synchronisiert, sobald wieder Internet verfügbar ist."}
    </div>
  );
}
