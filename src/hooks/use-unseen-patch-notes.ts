import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { markPatchNoteSeen, unseenPatchNotesQuery } from "@/lib/patch-notes";

/** Anzeige-Logik: ungesehene Patch Notes (älteste zuerst) + als gesehen markieren. */
export function useUnseenPatchNotes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery(unseenPatchNotesQuery(user?.id));

  const markSeen = useMutation({
    mutationFn: (id: string) => {
      if (!user) throw new Error("Nicht angemeldet");
      return markPatchNoteSeen(user.id, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patch-notes"] });
    },
  });

  return { notes: query.data ?? [], isLoading: query.isLoading, markSeen };
}
