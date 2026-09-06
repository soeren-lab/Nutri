import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { currentSeasonQuery, markSeasonSeen, seasonSeenQuery } from "@/lib/seasons";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Vollbild-Begrüßung beim ersten Start einer neuen Season.
 */
export function SeasonStartModal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const seasonQ = useQuery({ ...currentSeasonQuery(), enabled: !!user });
  const season = seasonQ.data ?? null;
  const seenQ = useQuery({ ...seasonSeenQuery(season?.id), enabled: !!user && !!season });

  const markSeen = useMutation({
    mutationFn: async () => {
      if (!user || !season) return;
      await markSeasonSeen(user.id, season.id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["season-seen"] });
    },
  });

  if (!season || seenQ.isLoading || seenQ.data !== false) return null;

  return (
    <Dialog open onOpenChange={() => markSeen.mutate()}>
      <DialogContent className="gap-0 overflow-hidden rounded-3xl border-border p-0 sm:max-w-md">
        <div className="space-y-2 p-6 pb-4 [background:linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--accent)/0.14))]">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-primary-foreground [background:var(--primary-gradient)]">
            <Trophy className="h-5 w-5" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Neue Season gestartet
          </p>
          <DialogTitle className="text-2xl font-bold leading-tight tracking-tight">
            {season.name}
          </DialogTitle>

          <p className="text-sm text-muted-foreground tabular-nums">
            {formatDate(season.start_date)} – {formatDate(season.end_date)}
          </p>
        </div>

        <div className="space-y-4 p-6 pt-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Alle 70 Tage startet eine neue Season. Deine Season-Punkte und der
            Season-Rang beginnen dabei wieder bei null – deine Gesamtpunkte, Abzeichen
            und dein Lifetime-Rang bleiben unverändert erhalten.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Das Ergebnis der letzten Season findest du in deiner Season-Historie im
            Profil.
          </p>
          <Button className="w-full" onClick={() => markSeen.mutate()}>
            Los geht&apos;s
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
