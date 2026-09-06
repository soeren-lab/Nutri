import { useEffect, useState } from "react";
import { onlineManager, useIsMutating } from "@tanstack/react-query";

/**
 * Nutzt TanStack Querys eigenen `onlineManager` statt eigener
 * Browser-Event-Handler – das ist dieselbe Quelle, die auch die
 * Mutation-Pause/Replay-Logik steuert.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setIsOnline), []);
  return isOnline;
}

/** True, solange noch Änderungen auf die Synchronisierung warten. */
export function useHasPendingSync(): boolean {
  return useIsMutating() > 0;
}
