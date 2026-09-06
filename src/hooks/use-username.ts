import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { saveUsername, usernameLockedUntil, usernameQuery } from "@/lib/username";

/** Username des eingeloggten Users lesen und setzen. */
export function useUsername() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const query = useQuery(usernameQuery(user?.id));

  const save = useMutation({
    mutationFn: (value: string) => {
      if (!user) throw new Error("Nicht angemeldet");
      return saveUsername(user.id, value, { isChange: !!query.data?.username });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["username"] });
      void qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });

  const lockedUntil = usernameLockedUntil(query.data?.changedAt);

  return {
    username: query.data?.username ?? null,
    /** Datum, ab dem der Username wieder geändert werden darf (null = jetzt erlaubt). */
    lockedUntil,
    /** true, sobald sicher ist, dass noch kein Username gesetzt ist. */
    needsUsername: !!user && !loading && query.isSuccess && !query.data?.username,
    isLoading: loading || query.isLoading,
    save,
  };
}
