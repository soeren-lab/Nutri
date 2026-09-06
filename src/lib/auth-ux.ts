import { supabase } from "@/integrations/supabase/client";

/** Passwort-Regeln, live in der Checkliste angezeigt. */
export const PASSWORD_RULES = [
  { id: "len", label: "Mindestens 8 Zeichen", test: (v: string) => v.length >= 8 },
  { id: "digit", label: "Mindestens eine Zahl", test: (v: string) => /\d/.test(v) },
  {
    id: "letter",
    label: "Mindestens ein Buchstabe",
    test: (v: string) => /[A-Za-zÄÖÜäöüß]/.test(v),
  },
  {
    id: "special",
    label: "Mindestens ein Sonderzeichen",
    test: (v: string) => /[^A-Za-z0-9ÄÖÜäöüß]/.test(v),
  },
] as const;

export function isStrongPassword(value: string) {
  return PASSWORD_RULES.every((r) => r.test(value));
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/** Übersetzt Supabase-Fehler in freundliche deutsche Meldungen. */
export function friendlyAuthError(raw: unknown): string {
  const msg = (raw instanceof Error ? raw.message : String(raw ?? "")).toLowerCase();
  if (msg.includes("already registered") || msg.includes("already been registered"))
    return "Für diese E-Mail existiert bereits ein Konto. Melde dich stattdessen an.";
  if (msg.includes("invalid login credentials"))
    return "E-Mail oder Passwort ist nicht korrekt.";
  if (msg.includes("email not confirmed"))
    return "Bitte bestätige zuerst deine E-Mail-Adresse über den Link in deinem Postfach.";
  if (msg.includes("invalid email") || msg.includes("email address") )
    return "Diese E-Mail-Adresse ist ungültig.";
  if (msg.includes("password should") || msg.includes("weak password"))
    return "Das Passwort ist zu schwach. Bitte wähle ein längeres Passwort.";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.";
  if (msg.includes("same password"))
    return "Das neue Passwort muss sich vom alten unterscheiden.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.";
  return "Etwas ist schiefgelaufen. Bitte versuche es erneut.";
}

/* ── Login-Rate-Limiting (clientseitig, ergänzend zum Server) ───────────── */

const ATTEMPT_KEY = "auth-login-attempts";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

type AttemptState = { count: number; until: number };

function readAttempts(): AttemptState {
  if (typeof window === "undefined") return { count: 0, until: 0 };
  try {
    const raw = window.localStorage.getItem(ATTEMPT_KEY);
    const parsed = raw ? (JSON.parse(raw) as AttemptState) : null;
    if (parsed && typeof parsed.count === "number") return parsed;
  } catch {
    /* ignore */
  }
  return { count: 0, until: 0 };
}

/** Sekunden bis zum Ende der Sperre (0 = nicht gesperrt). */
export function loginLockSeconds(): number {
  const { until } = readAttempts();
  const diff = until - Date.now();
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

export function registerFailedLogin(): number {
  const state = readAttempts();
  const count = state.count + 1;
  const until = count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0;
  if (typeof window !== "undefined")
    window.localStorage.setItem(
      ATTEMPT_KEY,
      JSON.stringify({ count: until ? 0 : count, until } satisfies AttemptState),
    );
  return until ? Math.ceil(LOCK_MS / 1000) : 0;
}

export function clearFailedLogins() {
  if (typeof window !== "undefined") window.localStorage.removeItem(ATTEMPT_KEY);
}

/* ── "Angemeldet bleiben" ───────────────────────────────────────────────── */

const REMEMBER_KEY = "auth-remember-me";
const TAB_MARKER = "auth-tab-active";

export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  if (!remember) window.sessionStorage.setItem(TAB_MARKER, "1");
}

/**
 * Beendet die Session beim Neustart des Browsers, wenn der Nutzer
 * "Angemeldet bleiben" nicht aktiviert hat.
 */
export async function enforceSessionPersistence() {
  if (typeof window === "undefined") return;
  const remember = window.localStorage.getItem(REMEMBER_KEY);
  if (remember !== "0") return;
  if (window.sessionStorage.getItem(TAB_MARKER) === "1") return;
  window.localStorage.removeItem(REMEMBER_KEY);
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.auth.signOut();
}
