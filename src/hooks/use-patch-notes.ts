import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  createPatchNote,
  deletePatchNote,
  patchNotesQuery,
  type PatchNoteDraft,
} from "@/lib/patch-notes";

/** Dev-Logik: Patch Notes anlegen, listen, löschen. */
export function usePatchNotes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery(patchNotesQuery());

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["patch-notes"] });
  };

  const publish = useMutation({
    mutationFn: (draft: PatchNoteDraft) => {
      if (!user) throw new Error("Nicht angemeldet");
      return createPatchNote(user.id, draft);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Patch Note veröffentlicht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePatchNote(id),
    onSuccess: () => {
      invalidate();
      toast.success("Patch Note gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { notes: query.data ?? [], isLoading: query.isLoading, publish, remove };
}
