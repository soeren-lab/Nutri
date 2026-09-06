import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import { FriendComparison } from "@/components/FriendComparison";
import { SeasonComparison } from "@/components/SeasonComparison";

import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RankBadge } from "@/components/RankBadge";
import { SearchInputWithBeam } from "@/components/SearchInputWithBeam";
import { UserAvatar } from "@/components/UserAvatar";
import {
  acceptFriendRequest,
  declineFriendRequest,
  endFriendship,
  incomingRequestsQuery,
  myFriendsQuery,
  outgoingRequestsQuery,
  sendFriendRequest,
  userSearchQuery,
  withdrawFriendRequest,
  type FriendUser,
} from "@/lib/friends";
import { rankForPoints } from "@/lib/ranks";

/** Freunde-Bereich: Suche, Anfragen und Freundesliste. */
export function FriendsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirmEnd, setConfirmEnd] = useState<FriendUser | null>(null);

  const friendsQ = useQuery(myFriendsQuery());
  const incomingQ = useQuery(incomingRequestsQuery());
  const outgoingQ = useQuery(outgoingRequestsQuery());
  const searchQ = useQuery(userSearchQuery(search));

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["friends"] });
  }

  const sendMut = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => {
      invalidate();
      toast.success("Anfrage gesendet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acceptMut = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      invalidate();
      toast.success("Freundschaft bestätigt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const declineMut = useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: () => {
      invalidate();
      toast.success("Anfrage abgelehnt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdrawMut = useMutation({
    mutationFn: withdrawFriendRequest,
    onSuccess: () => {
      invalidate();
      toast.success("Anfrage zurückgezogen");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const endMut = useMutation({
    mutationFn: endFriendship,
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["shares"] });
      setConfirmEnd(null);
      toast.success("Freundschaft beendet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const incoming = incomingQ.data ?? [];
  const outgoing = outgoingQ.data ?? [];
  const friends = friendsQ.data ?? [];
  const results = searchQ.data ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Nutzer suchen</p>
        <SearchInputWithBeam
          placeholder="Nutzer suchen (Username)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search.trim().length >= 2 && (
          <div className="space-y-2">
            {searchQ.isLoading ? (
              <LoadingSpinner />
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Nutzer gefunden.
              </p>
            ) : (
              results.map((r) => (
                <UserRow key={r.userId} user={r}>
                  {r.relation === "none" && (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={sendMut.isPending}
                      onClick={() => sendMut.mutate(r.userId)}
                    >
                      <UserPlus className="h-4 w-4" />
                      Anfrage senden
                    </Button>
                  )}
                  {r.relation === "outgoing" && (
                    <Button size="sm" variant="outline" disabled>
                      Angefragt
                    </Button>
                  )}
                  {r.relation === "friends" && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/profile/$username" params={{ username: r.username }}>
                        Profil ansehen
                      </Link>
                    </Button>
                  )}
                  {r.relation === "incoming" && r.requestId && (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={acceptMut.isPending}
                      onClick={() => acceptMut.mutate(r.requestId!)}
                    >
                      <Check className="h-4 w-4" />
                      Anfrage annehmen
                    </Button>
                  )}
                </UserRow>
              ))
            )}
          </div>
        )}
      </section>

      {incoming.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Anfragen ({incoming.length})</p>
          {incoming.map((r) => (
            <UserRow key={r.requestId} user={r}>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={acceptMut.isPending}
                onClick={() => acceptMut.mutate(r.requestId)}
              >
                <Check className="h-4 w-4" />
                Annehmen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                disabled={declineMut.isPending}
                onClick={() => declineMut.mutate(r.requestId)}
              >
                <X className="h-4 w-4" />
                Ablehnen
              </Button>
            </UserRow>
          ))}
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Gesendete Anfragen</p>
          {outgoing.map((r) => (
            <UserRow key={r.requestId} user={r}>
              <Button
                size="sm"
                variant="outline"
                disabled={withdrawMut.isPending}
                onClick={() => withdrawMut.mutate(r.requestId)}
              >
                Zurückziehen
              </Button>
            </UserRow>
          ))}
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Freunde ({friends.length})</p>
        {friendsQ.isLoading ? (
          <LoadingSpinner />
        ) : friends.length === 0 ? (
          <EmptyState
            title="Noch keine Freunde"
            description="Suche nach einem Username und sende eine Anfrage."
          />
        ) : (
          friends.map((f) => (
            <UserRow key={f.userId} user={f} to={f.username}>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setConfirmEnd(f)}
              >
                Entfernen
              </Button>
            </UserRow>
          ))
        )}
      </section>

      <FriendComparison />

      <SeasonComparison />



      <AlertDialog
        open={confirmEnd !== null}
        onOpenChange={(o) => !o && setConfirmEnd(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Freundschaft beenden?</AlertDialogTitle>
            <AlertDialogDescription>
              @{confirmEnd?.username} wird aus deiner Freundesliste entfernt. Alle
              gegenseitig geteilten Rezepte und Zutaten werden ebenfalls entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmEnd && endMut.mutate(confirmEnd.userId)}
            >
              {endMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Beenden"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserRow({
  user,
  to,
  children,
}: {
  user: FriendUser;
  /** Username: macht Avatar/Name klickbar zum Profil. */
  to?: string;
  children?: React.ReactNode;
}) {
  const rank = rankForPoints(user.totalPoints).current;
  const inner = (
    <>
      <UserAvatar label={user.username} avatarUrl={user.avatarUrl} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">@{user.username}</p>
        <p className="truncate text-xs text-muted-foreground">{rank.label}</p>
      </div>
      <RankBadge tier={rank} size={28} />
    </>
  );

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-2.5">
      {to ? (
        <Link
          to="/profile/$username"
          params={{ username: to }}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {inner}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>
      )}
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}
