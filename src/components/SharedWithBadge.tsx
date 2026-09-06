import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  myFriendsQuery,
  removeShare,
  sharesForContentQuery,
  type FriendContentType,
} from "@/lib/friends";

/** Zeigt „Geteilt mit: …" und erlaubt das Entfernen einzelner Freigaben. */
export function SharedWithBadge({
  contentType,
  contentId,
  className,
}: {
  contentType: FriendContentType;
  contentId: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const sharesQ = useQuery(sharesForContentQuery(contentType, contentId));
  const friendsQ = useQuery(myFriendsQuery());

  const remove = useMutation({
    mutationFn: removeShare,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["shares"] });
      void qc.invalidateQueries({ queryKey: ["shared_with_me"] });
      toast.success("Freigabe entfernt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shares = sharesQ.data ?? [];
  if (shares.length === 0) return null;

  const nameOf = (userId: string) =>
    friendsQ.data?.find((f) => f.userId === userId)?.username ?? "Freund";

  return (
    <div className={className}>
      <span className="text-xs text-muted-foreground">Geteilt mit: </span>
      <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
        {shares.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            @{nameOf(s.friendUserId)}
            <button
              type="button"
              aria-label={`Freigabe für @${nameOf(s.friendUserId)} entfernen`}
              className="opacity-70 transition-opacity hover:opacity-100"
              disabled={remove.isPending}
              onClick={() => remove.mutate(s.id)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </span>
    </div>
  );
}
