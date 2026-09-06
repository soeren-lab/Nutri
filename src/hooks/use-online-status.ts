import { useEffect, useState } from "react";
import { onlineManager, useIsMutating, useMutationState } from "@tanstack/react-query";

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

/**
 * True, wenn eine wiederhergestellte (nach App-Neustart resumte) Mutation
 * fehlgeschlagen ist. Nur diese haben kein eigenes onError mehr (siehe
 * dehydrateMutation/registerOfflineMutationDefaults) – ein regulärer
 * In-App-Fehler hat weiterhin sein eigenes onError und meldet sich schon
 * darüber, taucht hier also bewusst nicht doppelt auf.
 */
export function useHasFailedSync(): boolean {
  const failed = useMutationState({
    filters: {
      status: "error",
      predicate: (m) => !m.options.onError,
    },
  });
  return failed.length > 0;
}
