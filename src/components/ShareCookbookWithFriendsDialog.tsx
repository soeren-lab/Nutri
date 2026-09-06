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
import { myFriendsQuery } from "@/lib/friends";
import { cookbookMembersQuery, setCookbookMembers } from "@/lib/cookbooks";

/**
 * Auswahl-Dialog: Freunde direkt als Viewer eines eigenen Kochbuchs
 * hinzufügen – ohne dass sie einen Einladungslink öffnen müssen.
 */
export function ShareCookbookWithFriendsDialog({
  open,
  onOpenChange,
  cookbookId,
  cookbookTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cookbookId: string;
  cookbookTitle: string;
}) {
  const qc = useQueryClient();
  const friendsQ = useQuery({ ...myFriendsQuery(), enabled: open });
  const membersQ = useQuery({ ...cookbookMembersQuery(cookbookId), enabled: open });
  const [selected, setSelected] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!open) {
      setHydrated(false);
      return;
    }
    if (!hydrated && membersQ.data) {
      setSelected(membersQ.data);
      setHydrated(true);
    }
  }, [open, hydrated, membersQ.data]);

  const save = useMutation({
    mutationFn: () => setCookbookMembers(cookbookId, selected),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cookbooks"] });
      toast.success("Freigaben gespeichert");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const friends = friendsQ.data ?? [];

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mit Freund teilen</DialogTitle>
          <DialogDescription>
            „{cookbookTitle}“ direkt für ausgewählte Freunde freigeben – sie sehen
            das Kochbuch danach sofort in ihrer Übersicht (nur Ansicht).
          </DialogDescription>
        </DialogHeader>

        {friendsQ.isLoading || membersQ.isLoading ? (
          <LoadingSpinner />
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Du hast noch keine Freunde. Füge im Profil unter „Freunde“ jemanden hinzu.
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
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  @{f.username}
                </span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || friends.length === 0}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
