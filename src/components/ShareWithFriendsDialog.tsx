import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { UserAvatar } from "@/components/UserAvatar";
import { useSwipePriority } from "@/hooks/use-swipe-priority";
import {
  myFriendsQuery,
  setShares,
  sharesForContentQuery,
  type FriendContentType,
} from "@/lib/friends";

/**
 * Auswahl-Dialog: mit welchen Freunden ein eigenes Rezept / eine eigene
 * Zutat privat geteilt wird (unabhängig von der Community-Veröffentlichung).
 */
export function ShareWithFriendsDialog({
  open,
  onOpenChange,
  contentType,
  contentId,
  contentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: FriendContentType;
  contentId: string;
  contentName: string;
}) {
  const qc = useQueryClient();
  const friendsQ = useQuery({ ...myFriendsQuery(), enabled: open });
  const sharesQ = useQuery({
    ...sharesForContentQuery(contentType, contentId),
    enabled: open,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!open) {
      setHydrated(false);
      return;
    }
    if (!hydrated && sharesQ.data) {
      setSelected(sharesQ.data.map((s) => s.friendUserId));
      setHydrated(true);
    }
  }, [open, hydrated, sharesQ.data]);

  const save = useMutation({
    mutationFn: () => setShares(contentType, contentId, selected),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["shares"] });
      void qc.invalidateQueries({ queryKey: ["shared_with_me"] });
      toast.success("Freigaben gespeichert");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useSwipePriority(
    open
      ? { onSwipeLeft: () => onOpenChange(false), onSwipeRight: () => onOpenChange(false) }
      : null,
  );

  const friends = friendsQ.data ?? [];

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mit Freund teilen</DialogTitle>
          <DialogDescription>
            „{contentName}" nur für ausgewählte Freunde sichtbar machen – nicht öffentlich in der
            Community.
          </DialogDescription>
        </DialogHeader>

        {friendsQ.isLoading || sharesQ.isLoading ? (
          <LoadingSpinner />
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Du hast noch keine Freunde. Füge im Profil unter „Freunde" jemanden hinzu.
          </p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {friends.map((f) => (
              <label
                key={f.userId}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-2.5"
              >
                <Checkbox
                  checked={selected.includes(f.userId)}
                  onCheckedChange={() => toggle(f.userId)}
                />
                <UserAvatar
                  label={f.username}
                  avatarUrl={f.avatarUrl}
                  className="h-8 w-8 text-xs"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">@{f.username}</span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || friends.length === 0}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
