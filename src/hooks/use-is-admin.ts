import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { isAdminQuery } from "@/lib/patch-notes";

/** True, wenn der eingeloggte User die Admin-/Entwickler-Rolle hat. */
export function useIsAdmin() {
  const { user } = useAuth();
  const query = useQuery(isAdminQuery(user?.id));
  return { isAdmin: query.data === true, isLoading: query.isLoading };
}
