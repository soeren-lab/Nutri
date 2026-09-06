import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Loader2, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES, friendlyAuthError, isStrongPassword } from "@/lib/auth-ux";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Neues Passwort setzen – NUTRI" },
      {
        name: "description",
        content: "Setze ein neues Passwort für dein NUTRI-Konto.",
      },
      { property: "og:title", content: "Neues Passwort setzen – NUTRI" },
      { property: "og:description", content: "Setze ein neues Passwort für dein NUTRI-Konto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});

  useEffect(() => {
    // Recovery-Link liefert die Session per Hash bzw. über den Auth-Listener.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session || event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const matches = confirm.length > 0 && confirm === password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isStrongPassword(password)) next.password = "Das Passwort erfüllt nicht alle Anforderungen.";
    if (!matches) next.confirm = "Die Passwörter stimmen nicht überein.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      navigate({ to: "/recipes" });
    } catch (err) {
      setErrors({ form: friendlyAuthError(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span
            className="font-display bg-clip-text text-4xl leading-none font-black tracking-[0.16em] text-transparent"
            style={{ backgroundImage: "var(--primary-gradient)" }}
          >
            NUTRI
          </span>
          <p className="text-sm text-muted-foreground">Neues Passwort setzen</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          {!ready ? (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-primary-foreground [background:var(--primary-gradient)]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                Öffne diese Seite über den Link aus der E-Mail, um dein Passwort zu ändern.
              </p>
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl"
                onClick={() => navigate({ to: "/auth" })}
              >
                Zur Anmeldung
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Neues Passwort</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={show ? "text" : "password"}
                    value={password}
                    autoComplete="new-password"
                    enterKeyHint="next"
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl pr-11"
                    aria-invalid={!!errors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
                    className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                <ul className="space-y-1 pt-1">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(password);
                    return (
                      <li
                        key={rule.id}
                        className={cn(
                          "flex items-center gap-1.5 text-xs",
                          ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                        )}
                      >
                        {ok ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <X className="h-3.5 w-3.5 opacity-50" />
                        )}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-confirm">Passwort bestätigen</Label>
                <Input
                  id="new-confirm"
                  type={show ? "text" : "password"}
                  value={confirm}
                  autoComplete="new-password"
                  enterKeyHint="go"
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-12 rounded-xl"
                  aria-invalid={!!errors.confirm}
                />
                {errors.confirm ? (
                  <p className="text-xs text-destructive">{errors.confirm}</p>
                ) : confirm.length > 0 ? (
                  <p
                    className={cn(
                      "text-xs",
                      matches
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive",
                    )}
                  >
                    {matches ? "Passwörter stimmen überein" : "Passwörter stimmen nicht überein"}
                  </p>
                ) : null}
              </div>

              {errors.form && <p className="text-xs text-destructive">{errors.form}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl text-primary-foreground [background:var(--primary-gradient)] hover:opacity-90"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Passwort speichern
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
