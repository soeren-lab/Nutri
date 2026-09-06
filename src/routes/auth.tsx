import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { isUsernameAvailable, saveUsername, validateUsername } from "@/lib/username";
import {
  EMAIL_PATTERN,
  PASSWORD_RULES,
  clearFailedLogins,
  friendlyAuthError,
  isStrongPassword,
  loginLockSeconds,
  registerFailedLogin,
  setRememberMe,
} from "@/lib/auth-ux";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Anmelden oder registrieren – NUTRI" },
      {
        name: "description",
        content:
          "Melde dich bei NUTRI an oder erstelle ein Konto – dein Weg zu bewusster Ernährung.",
      },
      { property: "og:title", content: "Anmelden oder registrieren – NUTRI" },
      {
        property: "og:description",
        content: "Dein Weg zu bewusster Ernährung: Rezepte, Planer und Nährwerte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/recipes" });
  },
  component: AuthPage,
});

/* ── Bausteine ──────────────────────────────────────────────────────────── */

function Wordmark() {
  return (
    <span
      className="font-display bg-clip-text text-4xl leading-none font-black tracking-[0.16em] text-transparent"
      style={{ backgroundImage: "var(--primary-gradient)" }}
    >
      NUTRI
    </span>
  );
}

function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="text-xs text-destructive">{children}</p>;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  enterKeyHint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  enterKeyHint?: "next" | "done" | "go";
  error?: string | null;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          enterKeyHint={enterKeyHint}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 rounded-xl pr-11"
          aria-invalid={!!error}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

/* ── Seite ──────────────────────────────────────────────────────────────── */

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-64 opacity-[0.13]"
        style={{ background: "var(--primary-gradient)", filter: "blur(70px)" }}
        aria-hidden
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Wordmark />
          <p className="text-sm text-muted-foreground">Dein Weg zu bewusster Ernährung</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          {mode === "forgot" ? (
            <ForgotPasswordForm onBack={() => setMode("signin")} />
          ) : (
            <>
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList className="grid w-full grid-cols-2 rounded-xl">
                  <TabsTrigger value="signin" className="rounded-lg">
                    Anmelden
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-lg">
                    Registrieren
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="mt-5">
                {mode === "signin" ? (
                  <SignInForm onForgot={() => setMode("forgot")} />
                ) : (
                  <SignUpForm />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Anmelden ───────────────────────────────────────────────────────────── */

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [lock, setLock] = useState(0);

  useEffect(() => {
    setLock(loginLockSeconds());
  }, []);

  useEffect(() => {
    if (lock <= 0) return;
    const t = setInterval(() => setLock((s) => (s > 1 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [lock]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_PATTERN.test(email.trim())) next.email = "Bitte gib eine gültige E-Mail ein.";
    if (!password) next.password = "Bitte gib dein Passwort ein.";
    setErrors(next);
    if (Object.keys(next).length) return;
    if (lock > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      clearFailedLogins();
      setRememberMe(remember);
      navigate({ to: "/recipes" });
    } catch (err) {
      const seconds = registerFailedLogin();
      if (seconds) setLock(seconds);
      setErrors({ form: friendlyAuthError(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">E-Mail</Label>
        <Input
          id="signin-email"
          type="email"
          value={email}
          autoComplete="email"
          enterKeyHint="next"
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-xl"
          aria-invalid={!!errors.email}
        />
        <FieldError>{errors.email}</FieldError>
      </div>

      <PasswordField
        id="signin-password"
        label="Passwort"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        enterKeyHint="go"
        error={errors.password}
      />

      <label className="flex items-center gap-2.5 text-sm">
        <Checkbox
          checked={remember}
          onCheckedChange={(v) => setRemember(v === true)}
          aria-label="Angemeldet bleiben"
        />
        <span className="text-muted-foreground">Angemeldet bleiben</span>
      </label>

      {errors.form && <FieldError>{errors.form}</FieldError>}
      {lock > 0 && (
        <p className="text-xs text-destructive">
          Zu viele Fehlversuche. Bitte warte {lock} Sekunden.
        </p>
      )}

      <Button
        type="submit"
        disabled={loading || lock > 0}
        className="h-12 w-full rounded-xl text-primary-foreground [background:var(--primary-gradient)] hover:opacity-90"
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Anmelden
      </Button>

      <button
        type="button"
        onClick={onForgot}
        className="block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Passwort vergessen?
      </button>
    </form>
  );
}

/* ── Registrieren ───────────────────────────────────────────────────────── */

type UsernameStatus = "idle" | "checking" | "free" | "taken";

function SignUpForm() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const formatError = username ? validateUsername(username) : null;

  useEffect(() => {
    if (!username || formatError) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    let active = true;
    const t = setTimeout(() => {
      isUsernameAvailable(username)
        .then((free) => active && setStatus(free ? "free" : "taken"))
        .catch(() => active && setStatus("idle"));
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [username, formatError]);

  const passwordsMatch = confirm.length > 0 && confirm === password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string | undefined> = {};
    if (formatError) next.username = formatError;
    else if (!username) next.username = "Bitte wähle einen Username.";
    else if (status === "taken") next.username = "Bereits vergeben";
    if (!EMAIL_PATTERN.test(email.trim())) next.email = "Bitte gib eine gültige E-Mail ein.";
    if (!isStrongPassword(password)) next.password = "Das Passwort erfüllt nicht alle Anforderungen.";
    if (!passwordsMatch) next.confirm = "Die Passwörter stimmen nicht überein.";
    if (!accepted) next.terms = "Bitte akzeptiere die Bedingungen.";
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setLoading(true);
    try {
      const free = await isUsernameAvailable(username);
      if (!free) {
        setStatus("taken");
        setErrors({ username: "Bereits vergeben" });
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;

      if (data.session && data.user) {
        await saveUsername(data.user.id, username);
        clearFailedLogins();
        setRememberMe(true);
        navigate({ to: "/recipes" });
        return;
      }
      setSent(true);
    } catch (err) {
      setErrors({ form: friendlyAuthError(err) });
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-primary-foreground [background:var(--primary-gradient)]">
          <MailCheck className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">Fast fertig!</h2>
        <p className="text-sm text-muted-foreground">
          Wir haben dir eine E-Mail geschickt. Bestätige den Link darin, um dein Konto zu
          aktivieren.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="signup-username">Username</Label>
        <div className="relative">
          <Input
            id="signup-username"
            value={username}
            maxLength={20}
            autoComplete="off"
            enterKeyHint="next"
            placeholder="z. B. koch_maxi"
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
            className="h-12 rounded-xl pr-10"
            aria-invalid={!!errors.username || status === "taken"}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {status === "checking" && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {status === "free" && <Check className="h-4 w-4 text-emerald-500" />}
            {status === "taken" && <X className="h-4 w-4 text-destructive" />}
          </span>
        </div>
        {formatError ? (
          <FieldError>{formatError}</FieldError>
        ) : status === "taken" ? (
          <FieldError>Bereits vergeben</FieldError>
        ) : status === "free" ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Username ist frei</p>
        ) : (
          <FieldError>{errors.username}</FieldError>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-email">E-Mail</Label>
        <Input
          id="signup-email"
          type="email"
          value={email}
          autoComplete="email"
          enterKeyHint="next"
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-xl"
          aria-invalid={!!errors.email}
        />
        <FieldError>{errors.email}</FieldError>
      </div>

      <div className="space-y-2">
        <PasswordField
          id="signup-password"
          label="Passwort"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          enterKeyHint="next"
          error={errors.password}
        />
        <ul className="space-y-1">
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
                {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 opacity-50" />}
                {rule.label}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-1.5">
        <PasswordField
          id="signup-confirm"
          label="Passwort bestätigen"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          enterKeyHint="done"
          error={errors.confirm}
        />
        {confirm.length > 0 && !errors.confirm && (
          <p
            className={cn(
              "text-xs",
              passwordsMatch
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive",
            )}
          >
            {passwordsMatch ? "Passwörter stimmen überein" : "Passwörter stimmen nicht überein"}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="signup-terms"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="signup-terms" className="text-sm leading-snug font-normal text-muted-foreground">
            Ich akzeptiere die{" "}
            <Link to="/legal/agb" className="text-primary underline underline-offset-2">
              Nutzungsbedingungen
            </Link>{" "}
            und{" "}
            <Link to="/legal/datenschutz" className="text-primary underline underline-offset-2">
              Datenschutzerklärung
            </Link>
          </Label>
        </div>
        <FieldError>{errors.terms}</FieldError>
      </div>

      {errors.form && <FieldError>{errors.form}</FieldError>}

      <Button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-xl text-primary-foreground [background:var(--primary-gradient)] hover:opacity-90"
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Konto erstellen
      </Button>
    </form>
  );
}

/* ── Passwort vergessen ─────────────────────────────────────────────────── */

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Bitte gib eine gültige E-Mail ein.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setDone(true);
    } catch {
      // Neutral bleiben – keine Aussage über existierende Konten.
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück
      </button>

      {done ? (
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-primary-foreground [background:var(--primary-gradient)]">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            Falls diese E-Mail registriert ist, wurde ein Link zum Zurücksetzen gesendet.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Passwort zurücksetzen</h2>
            <p className="text-sm text-muted-foreground">
              Wir senden dir einen Link, mit dem du ein neues Passwort setzen kannst.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">E-Mail</Label>
            <Input
              id="forgot-email"
              type="email"
              value={email}
              autoComplete="email"
              enterKeyHint="go"
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl"
              aria-invalid={!!error}
            />
            <FieldError>{error}</FieldError>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl text-primary-foreground [background:var(--primary-gradient)] hover:opacity-90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset-Link senden
          </Button>
        </form>
      )}
    </div>
  );
}
