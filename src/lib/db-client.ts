/**
 * Schlanker Client für die eigene NAS-API (Express + MariaDB).
 *
 * Bietet die gleiche Aufrufsyntax wie zuvor (`from().select().eq()…`, `rpc()`, `auth.*`,
 * `storage.from()`), damit die Fachlogik in src/lib und src/components unverändert bleibt.
 * Alle Netzwerkfehler werden als `{ data: null, error }` zurückgegeben (nie als leerer Bildschirm);
 * zusätzlich feuert `window` das Ereignis "api-unreachable", worauf die App ein Banner zeigt.
 */

export type ApiError = { message: string; code?: string; details?: unknown; name?: string };
type Result<T = unknown> = { data: T | null; error: ApiError | null; count?: number | null };

type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
  user: AuthUser;
};
export type AuthUser = {
  id: string;
  email: string;
  created_at?: string;
  email_confirmed_at?: string | null;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  [k: string]: unknown;
};
type AuthEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED";

export const UNREACHABLE_MESSAGE =
  "Der Server ist nicht erreichbar. Bist du mit dem Heimnetz (WLAN) oder Tailscale verbunden?";

/**
 * `VITE_API_URL` darf mehrere Adressen enthalten, durch Komma getrennt
 * (z. B. Heimnetz zuerst, dann Tailscale). Die erste erreichbare gewinnt.
 */
function configuredBases(): string[] {
  const raw = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  return raw
    .split(",")
    .map((u) => u.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

const BASE_KEY = "nutri.apiBase.v1";

// Zuletzt funktionierende Adresse merken: spart beim Start das Warten auf die
// jeweils nicht erreichbare (z. B. Heimnetz-Adresse unterwegs).
let activeBase: string | null = (() => {
  try {
    const saved = localStorage.getItem(BASE_KEY);
    return saved && configuredBases().includes(saved) ? saved : null;
  } catch {
    return null;
  }
})();
let probing: Promise<string> | null = null;
let baseVerified = false;
let verifying: Promise<void> | null = null;

/** Einmal pro Start: gemerkte Adresse kurz prüfen, sonst neu wählen (nie lange hängen). */
function verifyBase(): Promise<void> {
  if (!verifying) {
    verifying = (async () => {
      if (activeBase) {
        const ok = await fetch(`${activeBase}/health`, { signal: AbortSignal.timeout(1500) })
          .then((r) => r.ok)
          .catch(() => false);
        if (!ok) await resolveApiBase(true);
      } else {
        await resolveApiBase(true);
      }
      baseVerified = true;
    })();
  }
  return verifying;
}

function apiBase(): string {
  const bases = configuredBases();
  if (!bases.length) {
    throw new Error("VITE_API_URL fehlt. Trage die Adresse deiner NAS-API in die .env-Datei ein.");
  }
  return activeBase ?? bases[0];
}

/** Aktuell genutzte API-Adresse (für Statusprüfungen). */
export function getApiBase(): string {
  return apiBase();
}

/** Prüft alle Adressen parallel und wählt die erste (in Reihenfolge) mit Antwort auf /health. */
export function resolveApiBase(force = false): Promise<string> {
  const bases = configuredBases();
  if (bases.length <= 1) return Promise.resolve(apiBase());
  if (!force && activeBase) return Promise.resolve(activeBase);
  if (probing) return probing;
  probing = (async () => {
    const results = await Promise.all(
      bases.map((b) =>
        fetch(`${b}/health`, { signal: AbortSignal.timeout(1500) })
          .then((r) => r.ok)
          .catch(() => false),
      ),
    );
    const idx = results.indexOf(true);
    if (idx >= 0) {
      activeBase = bases[idx];
      try {
        localStorage.setItem(BASE_KEY, activeBase);
      } catch {
        /* Speicher gesperrt */
      }
    }
    return activeBase ?? bases[0];
  })().finally(() => {
    probing = null;
  });
  return probing;
}

const STORAGE_KEY = "nutri.auth.v1";

function readStored(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
function writeStored(s: Session | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Speicher gesperrt – Sitzung gilt nur bis zum Neuladen */
  }
}

// ------------------------------------------------------------------ Auth-Zustand

let memorySession: Session | null | undefined;
const listeners = new Set<(event: AuthEvent, session: Session | null) => void>();

function getStoredSession(): Session | null {
  if (memorySession === undefined) memorySession = readStored();
  return memorySession;
}
function setSession(s: Session | null, event: AuthEvent) {
  memorySession = s;
  writeStored(s);
  listeners.forEach((cb) => {
    try {
      cb(event, s);
    } catch (e) {
      console.error("[auth] Listener-Fehler", e);
    }
  });
}

let refreshing: Promise<Session | null> | null = null;

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  const multi = configuredBases().length > 1;
  try {
    if (multi && !baseVerified) await verifyBase();
    return await fetch(`${apiBase()}${path}`, init);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("VITE_API_URL")) throw e;
    if (multi) {
      // Netzwechsel (WLAN <-> Mobilfunk/Tailscale): Adresse neu wählen, einmal wiederholen.
      const before = activeBase;
      await resolveApiBase(true);
      if (activeBase && activeBase !== before) {
        try {
          return await fetch(`${apiBase()}${path}`, init);
        } catch {
          /* weiter zur Fehlermeldung */
        }
      }
    }
    try {
      window.dispatchEvent(new CustomEvent("api-unreachable"));
    } catch {
      /* SSR */
    }
    return null;
  }
}

async function refreshSession(): Promise<Session | null> {
  if (refreshing) return refreshing;
  const current = getStoredSession();
  if (!current) return null;
  refreshing = (async () => {
    const res = await rawFetch("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    if (!res) return current; // offline: alte Sitzung behalten
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.error || !json?.data) {
      setSession(null, "SIGNED_OUT");
      return null;
    }
    setSession(json.data as Session, "TOKEN_REFRESHED");
    return json.data as Session;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function validToken(): Promise<string | null> {
  let s = getStoredSession();
  if (!s) return null;
  if (s.expires_at - Date.now() / 1000 < 60) s = await refreshSession();
  return s?.access_token ?? null;
}

/** Authentifizierter Aufruf mit einmaligem Refresh bei 401. */
async function authed(path: string, init: RequestInit = {}): Promise<Response | null> {
  const doFetch = async (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return rawFetch(path, { ...init, headers });
  };
  let res = await doFetch(await validToken());
  if (res && res.status === 401) {
    const fresh = await refreshSession();
    if (fresh) res = await doFetch(fresh.access_token);
  }
  return res;
}

async function postJson<T>(path: string, body: unknown, auth = true): Promise<Result<T>> {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  };
  const res = await (auth ? authed(path, init) : rawFetch(path, init));
  if (!res) return { data: null, error: { message: UNREACHABLE_MESSAGE, code: "network" } };
  const json = await res.json().catch(() => null);
  if (!json)
    return {
      data: null,
      error: { message: `Serverfehler (${res.status})`, code: String(res.status) },
    };
  if (res.status === 401 && !json.error) {
    return { data: null, error: { message: "Nicht angemeldet", code: "401" } };
  }
  return { data: json.data ?? null, error: json.error ?? null, count: json.count ?? null };
}

// ------------------------------------------------------------------ Query-Builder

type Filter = { op: string; col?: string; val?: unknown; operator?: string };

type PostFn = <T>(path: string, body: unknown) => Promise<Result<T>>;

class Builder<T = unknown> implements PromiseLike<Result<T>> {
  private body: Record<string, unknown>;
  private filters: Filter[] = [];
  private orders: { col: string; ascending: boolean; nullsFirst?: boolean }[] = [];

  constructor(
    table: string,
    private post: PostFn = (p, b) => postJson(p, b),
  ) {
    this.body = { table, op: "select", select: "*" };
  }

  select(cols = "*", opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    if (this.body.op === "select") {
      this.body.select = cols;
      if (opts?.count) this.body.count = opts.count;
      if (opts?.head) this.body.head = true;
    } else {
      this.body.returning = cols || true;
    }
    return this;
  }
  insert(values: unknown) {
    this.body.op = "insert";
    this.body.values = values;
    return this;
  }
  upsert(values: unknown, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.body.op = "upsert";
    this.body.values = values;
    if (opts?.onConflict) this.body.onConflict = opts.onConflict.split(",").map((s) => s.trim());
    if (opts?.ignoreDuplicates) this.body.ignoreDuplicates = true;
    return this;
  }
  update(values: unknown) {
    this.body.op = "update";
    this.body.values = values;
    return this;
  }
  delete() {
    this.body.op = "delete";
    return this;
  }

  private f(op: string, col: string, val: unknown) {
    this.filters.push({ op, col, val });
    return this;
  }
  eq(col: string, val: unknown) {
    return this.f("eq", col, val);
  }
  neq(col: string, val: unknown) {
    return this.f("neq", col, val);
  }
  gt(col: string, val: unknown) {
    return this.f("gt", col, val);
  }
  gte(col: string, val: unknown) {
    return this.f("gte", col, val);
  }
  lt(col: string, val: unknown) {
    return this.f("lt", col, val);
  }
  lte(col: string, val: unknown) {
    return this.f("lte", col, val);
  }
  like(col: string, val: string) {
    return this.f("like", col, val);
  }
  ilike(col: string, val: string) {
    return this.f("ilike", col, val);
  }
  is(col: string, val: unknown) {
    return this.f("is", col, val);
  }
  in(col: string, val: unknown[]) {
    return this.f("in", col, val);
  }
  contains(col: string, val: unknown) {
    return this.f("contains", col, val);
  }
  match(obj: Record<string, unknown>) {
    this.filters.push({ op: "match", val: obj });
    return this;
  }
  not(col: string, operator: string, val: unknown) {
    this.filters.push({ op: "not", col, operator, val });
    return this;
  }
  or(expr: string) {
    this.filters.push({ op: "or", val: expr });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ col, ascending: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst });
    return this;
  }
  limit(n: number) {
    this.body.limit = n;
    return this;
  }
  range(from: number, to: number) {
    this.body.offset = from;
    this.body.limit = to - from + 1;
    return this;
  }
  single() {
    this.body.single = "single";
    return this as unknown as Builder<T>;
  }
  maybeSingle() {
    this.body.single = "maybe";
    return this as unknown as Builder<T>;
  }
  throwOnError() {
    this.thr = true;
    return this;
  }
  abortSignal() {
    return this;
  }
  private thr = false;

  private async run(): Promise<Result<T>> {
    const payload = { ...this.body, filters: this.filters, order: this.orders };
    const res = await this.post<T>("/rest/query", payload);
    if (this.thr && res.error) throw Object.assign(new Error(res.error.message), res.error);
    return res;
  }

  then<R1 = Result<T>, R2 = never>(
    onfulfilled?: ((value: Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

class RpcBuilder<T = unknown> implements PromiseLike<Result<T>> {
  private mode: "single" | "maybe" | null = null;
  constructor(
    private name: string,
    private args: unknown,
    private post: PostFn = (p, b) => postJson(p, b),
  ) {}
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }
  private async run(): Promise<Result<T>> {
    const res = await this.post<unknown>(`/rest/rpc/${this.name}`, this.args ?? {});
    if (res.error || !this.mode) return res as Result<T>;
    const rows = Array.isArray(res.data) ? res.data : res.data == null ? [] : [res.data];
    if (this.mode === "single" && rows.length !== 1) {
      return {
        data: null,
        error: {
          message: "JSON object requested, multiple (or no) rows returned",
          code: "PGRST116",
        },
      };
    }
    return { data: (rows[0] ?? null) as T, error: null };
  }
  then<R1 = Result<T>, R2 = never>(
    onfulfilled?: ((value: Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

// ------------------------------------------------------------------ Auth-API

const authError = (message: string, code?: string): ApiError => ({
  message,
  code,
  name: "AuthApiError",
});

const auth = {
  async getSession() {
    const s = getStoredSession();
    return { data: { session: s }, error: null };
  },
  async refreshSession() {
    const s = await refreshSession();
    return {
      data: { session: s, user: s?.user ?? null },
      error: s ? null : authError("Sitzung abgelaufen"),
    };
  },
  async getUser() {
    const s = getStoredSession();
    if (!s)
      return { data: { user: null }, error: authError("Auth session missing!", "session_missing") };
    const res = await authed("/auth/user");
    if (!res) return { data: { user: s.user }, error: null }; // offline: gespeicherten Nutzer verwenden
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.error) {
      return {
        data: { user: null },
        error: authError(json?.error?.message ?? "Nicht angemeldet", json?.error?.code),
      };
    }
    return { data: { user: json.data as AuthUser }, error: null };
  },
  onAuthStateChange(cb: (event: AuthEvent, session: Session | null) => void) {
    listeners.add(cb);
    queueMicrotask(() => cb("INITIAL_SESSION", getStoredSession()));
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },
  async signInWithPassword(creds: { email: string; password: string }) {
    const res = await postJson<Session>("/auth/login", creds, false);
    if (res.error || !res.data) {
      return {
        data: { user: null, session: null },
        error: authError(res.error?.message ?? "Anmeldung fehlgeschlagen", res.error?.code),
      };
    }
    setSession(res.data, "SIGNED_IN");
    return { data: { user: res.data.user, session: res.data }, error: null };
  },
  async signUp(args: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown> };
  }) {
    const res = await postJson<Session>(
      "/auth/signup",
      { email: args.email, password: args.password, data: args.options?.data },
      false,
    );
    if (res.error || !res.data) {
      return {
        data: { user: null, session: null },
        error: authError(res.error?.message ?? "Registrierung fehlgeschlagen", res.error?.code),
      };
    }
    setSession(res.data, "SIGNED_IN");
    return { data: { user: res.data.user, session: res.data }, error: null };
  },
  async signOut() {
    const s = getStoredSession();
    if (s) {
      await authed("/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      }).catch(() => null);
    }
    setSession(null, "SIGNED_OUT");
    return { error: null };
  },
  async updateUser(attrs: { email?: string; password?: string; data?: Record<string, unknown> }) {
    const res = await authed("/auth/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attrs),
    });
    if (!res) return { data: { user: null }, error: authError(UNREACHABLE_MESSAGE, "network") };
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.error) {
      return {
        data: { user: null },
        error: authError(json?.error?.message ?? "Fehler", json?.error?.code),
      };
    }
    const s = getStoredSession();
    if (s) setSession({ ...s, user: json.data as AuthUser }, "USER_UPDATED");
    return { data: { user: json.data as AuthUser }, error: null };
  },
  async resetPasswordForEmail(email: string) {
    const res = await postJson("/auth/recover", { email }, false);
    return { data: {}, error: res.error ? authError(res.error.message, res.error.code) : null };
  },
};

// ------------------------------------------------------------------ Datei-Speicher

function bucketApi(bucket: string) {
  const abs = (u: string) => (u.startsWith("http") ? u : `${apiBase()}${u}`);
  return {
    async upload(
      path: string,
      file: Blob | File | ArrayBuffer,
      opts?: { contentType?: string; upsert?: boolean },
    ) {
      const type =
        opts?.contentType || (file instanceof Blob ? file.type : "") || "application/octet-stream";
      const res = await authed(
        `/storage/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`,
        {
          method: "PUT",
          headers: { "Content-Type": type, "x-upsert": opts?.upsert ? "true" : "false" },
          body: file as BodyInit,
        },
      );
      if (!res) return { data: null, error: { message: UNREACHABLE_MESSAGE, code: "network" } };
      const json = await res.json().catch(() => null);
      return {
        data: json?.data ?? null,
        error:
          json?.error ?? (res.ok ? null : { message: `Upload fehlgeschlagen (${res.status})` }),
      };
    },
    async createSignedUrl(path: string, expiresIn = 3600) {
      const res = await postJson<
        { path: string; signedUrl: string | null; error: string | null }[]
      >(`/storage/${bucket}/sign`, { path, expiresIn });
      const row = res.data?.[0];
      if (res.error || !row?.signedUrl) {
        return { data: null, error: res.error ?? { message: row?.error ?? "Object not found" } };
      }
      return { data: { signedUrl: abs(row.signedUrl) }, error: null };
    },
    async createSignedUrls(paths: string[], expiresIn = 3600) {
      const res = await postJson<
        { path: string; signedUrl: string | null; error: string | null }[]
      >(`/storage/${bucket}/sign`, { paths, expiresIn });
      if (res.error) return { data: null, error: res.error };
      return {
        data: (res.data ?? []).map((r) => ({
          ...r,
          signedUrl: r.signedUrl ? abs(r.signedUrl) : (null as string | null),
        })),
        error: null,
      };
    },
    async download(path: string) {
      const res = await authed(
        `/storage/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`,
      );
      if (!res) return { data: null, error: { message: UNREACHABLE_MESSAGE, code: "network" } };
      if (!res.ok)
        return { data: null, error: { message: "Object not found", code: String(res.status) } };
      return { data: await res.blob(), error: null };
    },
    async list(prefix = "") {
      return postJson<{ name: string }[]>(`/storage/${bucket}/list`, { prefix });
    },
    async remove(paths: string[]) {
      return postJson<{ name: string }[]>(`/storage/${bucket}/remove`, { paths });
    },
  };
}

// ------------------------------------------------------------------ Export

export const db = {
  from: (table: string) => new Builder(table),
  rpc: (name: string, args?: unknown) => new RpcBuilder(name, args),
  auth,
  storage: { from: bucketApi },
};

/** Direkter Aufruf der API (für Funktionen, die nicht zu from()/rpc() passen). */
export async function apiPost<T>(path: string, body: unknown): Promise<Result<T>> {
  return postJson<T>(path, body);
}

/** Kochbuch-PDF von der NAS holen: bei Erfolg das PDF, sonst ein Fehler mit Klartext. */
export async function apiPostPdf(path: string, body: unknown): Promise<Result<Blob>> {
  const res = await authed(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res) return { data: null, error: { message: UNREACHABLE_MESSAGE, code: "network" } };
  if ((res.headers.get("content-type") ?? "").includes("application/pdf")) {
    return { data: await res.blob(), error: null };
  }
  const json = await res.json().catch(() => null);
  return {
    data: null,
    error: json?.error ?? { message: `Serverfehler (${res.status})`, code: String(res.status) },
  };
}

/**
 * Server-seitiger Client (Worker/SSR): ruft die API mit einem festen Bearer-Token auf.
 * `baseUrl` ist die von dort erreichbare API-Adresse.
 */
export function createTokenClient(baseUrl: string, token: string) {
  const post: PostFn = async <T>(path: string, body: unknown): Promise<Result<T>> => {
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json().catch(() => null);
      if (!json) return { data: null, error: { message: `Serverfehler (${res.status})` } };
      return { data: json.data ?? null, error: json.error ?? null, count: json.count ?? null };
    } catch {
      return { data: null, error: { message: UNREACHABLE_MESSAGE, code: "network" } };
    }
  };
  return {
    from: (table: string) => new Builder(table, post),
    rpc: (name: string, args?: unknown) => new RpcBuilder(name, args, post),
  };
}
