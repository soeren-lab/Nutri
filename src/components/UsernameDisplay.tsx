import { useEffect, useState } from "react";
import { AtSign, Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUsername } from "@/hooks/use-username";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { isUsernameAvailable, validateUsername } from "@/lib/username";

const dateFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long", year: "numeric" });

type Status = "idle" | "checking" | "free" | "taken";

/**
 * Zeigt den Username prominent an – mit Bearbeiten-Button.
 * Fallback: "Username festlegen", falls noch keiner gesetzt ist.
 */
export function UsernameDisplay() {
  const { username, isLoading, save, lockedUntil } = useUsername();
  const { avatarUrl } = useUserAvatar();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      {avatarUrl ? (
        <UserAvatar label={username ?? "?"} avatarUrl={avatarUrl} className="h-9 w-9" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-primary-foreground [background:var(--primary-gradient)]">
          <AtSign className="h-4 w-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : username ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              @{username}
            </p>
            <p className="text-xs text-muted-foreground">Username</p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-muted-foreground">
              Kein Username
            </p>
            <p className="text-xs text-muted-foreground">Noch festlegen</p>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => setOpen(true)}
        aria-label={username ? "Username bearbeiten" : "Username festlegen"}
      >
        {username ? <Pencil className="h-4 w-4" /> : <AtSign className="h-4 w-4" />}
      </Button>

      <EditDialog
        open={open}
        onOpenChange={setOpen}
        currentUsername={username}
        lockedUntil={lockedUntil}
        isPending={save.isPending}
        onSave={async (value) => {
          await save.mutateAsync(value);
          toast.success("Username gespeichert");
        }}
      />
    </div>
  );
}

function EditDialog({
  open,
  onOpenChange,
  currentUsername,
  lockedUntil,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUsername: string | null;
  lockedUntil: Date | null;
  onSave: (value: string) => Promise<void>;
  isPending: boolean;
}) {
  const [value, setValue] = useState(currentUsername ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Beim Öffnen aktuellen Wert vorausfüllen
  useEffect(() => {
    if (open) {
      setValue(currentUsername ?? "");
      setStatus(currentUsername ? "free" : "idle");
      setError(null);
    }
  }, [open, currentUsername]);

  const formatError = value ? validateUsername(value) : null;
  const unchanged = !!currentUsername && value === currentUsername;

  useEffect(() => {
    setError(null);
    if (!value || formatError || unchanged) {
      setStatus(unchanged ? "free" : "idle");
      return;
    }
    setStatus("checking");
    let active = true;
    const t = setTimeout(() => {
      isUsernameAvailable(value)
        .then((free) => {
          if (active) setStatus(free ? "free" : "taken");
        })
        .catch(() => {
          if (active) setStatus("idle");
        });
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [value, formatError, unchanged]);

  const locked = !!lockedUntil;
  const canSave = (status === "free" || unchanged) && !isPending && !locked;
  const hint = formatError ?? (status === "taken" ? "Dieser Username ist bereits vergeben" : null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || unchanged) return;
    try {
      await onSave(value);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {currentUsername ? "Username bearbeiten" : "Username festlegen"}
          </DialogTitle>
          <DialogDescription>
            Dein Username ist einmalig in der App und wird anderen angezeigt.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="username-edit">Username</Label>
            <div className="relative">
              <Input
                id="username-edit"
                autoFocus
                autoComplete="off"
                value={value}
                maxLength={20}
                placeholder="z. B. koch_maxi"
                disabled={locked}
                onChange={(e) => setValue(e.target.value.replace(/\s/g, ""))}
                className="pr-9"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {status === "checking" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {status === "free" && <Check className="h-4 w-4 text-emerald-500" />}
                {status === "taken" && <X className="h-4 w-4 text-destructive" />}
              </span>
            </div>
            <p className="min-h-4 text-xs">
              {locked ? (
                <span className="text-muted-foreground">
                  Du kannst deinen Username erst wieder am {dateFmt.format(lockedUntil!)} ändern
                </span>
              ) : hint ? (
                <span className="text-destructive">{hint}</span>
              ) : status === "free" ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Username ist verfügbar
                </span>
              ) : (
                <span className="text-muted-foreground">
                  3–20 Zeichen: Buchstaben, Zahlen, Unterstrich
                </span>
              )}
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={!canSave} className="rounded-xl">
              {isPending ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
