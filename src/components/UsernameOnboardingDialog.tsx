import { useEffect, useState } from "react";
import { AtSign, Check, Loader2, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUsername } from "@/hooks/use-username";
import { isUsernameAvailable, validateUsername } from "@/lib/username";

type Status = "idle" | "checking" | "free" | "taken";

/** Pflicht-Onboarding: erzwingt einen eindeutigen Username. Nicht schließbar. */
export function UsernameOnboardingDialog() {
  const { needsUsername, save } = useUsername();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const formatError = value ? validateUsername(value) : null;

  useEffect(() => {
    setError(null);
    if (!value || formatError) {
      setStatus("idle");
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
  }, [value, formatError]);

  if (!needsUsername) return null;

  const canSave = status === "free" && !save.isPending;
  const hint = formatError ?? (status === "taken" ? "Dieser Username ist bereits vergeben" : null);

  return (
    <DialogPrimitive.Root open>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-background shadow-lg"
        >
          <div className="space-y-2 p-6 pb-4 [background:linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--accent)/0.12))]">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-primary-foreground [background:var(--primary-gradient)]">
              <AtSign className="h-5 w-5" />
            </div>
            <DialogPrimitive.Title className="text-2xl font-bold leading-tight tracking-tight">
              Wähle deinen Username
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              Dein Username ist einmalig in der App und wird anderen angezeigt.
            </DialogPrimitive.Description>
          </div>

          <form
            className="space-y-4 p-6 pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSave) return;
              save.mutate(value, {
                onError: (err: Error) => setError(err.message),
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <Input
                  id="username"
                  autoFocus
                  autoComplete="off"
                  value={value}
                  maxLength={20}
                  placeholder="z. B. koch_maxi"
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
                {hint ? (
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

            <Button type="submit" disabled={!canSave} className="w-full rounded-xl">
              {save.isPending ? "Speichern…" : "Speichern"}
            </Button>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
