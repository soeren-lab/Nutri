import { WifiOff } from "lucide-react";
import { useHasPendingSync, useOnlineStatus } from "@/hooks/use-online-status";

/**
 * Dezenter Hinweis statt Sperre: Rezepte/Zutaten/Planer bleiben offline
 * nutzbar, Änderungen werden lokal gespeichert und synchronisiert, sobald
 * wieder eine Verbindung besteht.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const hasPendingSync = useHasPendingSync();

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
