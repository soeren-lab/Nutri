import express from "express";
import cors from "cors";
import { pool, query } from "./db.js";
import {
  requireAuth,
  signUp,
  signIn,
  refresh,
  signOut,
  getUser,
  updateUser,
  deleteUser,
  signScoped,
  verifyAccess,
} from "./auth.js";
import {
  ApiError,
  parseSelect,
  runSelect,
  runInsert,
  runUpdate,
  runDelete,
  translateDbError,
  shapeResult,
} from "./query.js";
import { callRpc } from "./rpc.js";
import { analyzeMealPhoto, getAnthropicKey } from "./photoScan.js";
import { renderCookbookPdf } from "./cookbookPdf.js";
import { canRead, putObject, getObject, removeObjects, listObjects, removeUserFiles } from "./storage.js";

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: true, allowedHeaders: ["Authorization", "Content-Type", "x-upsert"] }));
app.use(express.json({ limit: "20mb" }));

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    const err = e instanceof ApiError ? e : translateDbError(e);
    // Auth-Fehler bekommen 400/401, Datenfehler antworten 200 mit error (wie supabase-js erwartet).
    const authLike = String(req.path).startsWith("/auth/");
    res.status(authLike ? 400 : 200).json({ data: null, error: { message: err.message, code: err.code, details: err.details } });
  }
};

app.get("/health", wrap(async (_req, res) => {
  await query("SELECT 1");
  // ai: ob ein KI-Schlüssel gefunden wurde (nur ja/nein, nie der Schlüssel selbst).
  res.json({ ok: true, ai: Boolean(getAnthropicKey()) });
}));

// ------------------------------------------------------------------ Auth
app.post("/auth/signup", wrap(async (req, res) => res.json({ data: await signUp(req.body || {}), error: null })));
app.post("/auth/login", wrap(async (req, res) => res.json({ data: await signIn(req.body || {}), error: null })));
app.post("/auth/refresh", wrap(async (req, res) => res.json({ data: await refresh(req.body?.refresh_token), error: null })));
app.post("/auth/logout", wrap(async (req, res) => {
  let uid = null;
  try {
    uid = verifyAccess((req.headers.authorization || "").slice(7)).sub;
  } catch {
    /* Token evtl. abgelaufen – Refresh-Token reicht */
  }
  await signOut(req.body?.refresh_token, uid, req.body?.scope === "global");
  res.json({ data: null, error: null });
}));
app.get("/auth/user", requireAuth, wrap(async (req, res) => res.json({ data: await getUser(req.uid), error: null })));
app.put("/auth/user", requireAuth, wrap(async (req, res) => res.json({ data: await updateUser(req.uid, req.body || {}), error: null })));
app.post("/auth/recover", wrap(async () => {
  throw new ApiError(
    "Passwort-Reset per E-Mail gibt es nicht. Bitte wende dich an den Admin, er setzt dir ein neues Passwort.",
    "recovery_unavailable",
  );
}));

// ------------------------------------------------------------------ Daten
app.post("/rest/query", requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const uid = req.uid;
  const filters = b.filters || [];
  let data = null;
  let count = null;
  switch (b.op) {
    case "select": {
      const parsed = parseSelect(b.select || "*");
      const { rows, total } = await runSelect(b.table, parsed, {
        uid,
        filters,
        order: b.order,
        limit: b.limit,
        offset: b.offset,
        count: Boolean(b.count),
      });
      count = b.count ? total : null;
      data = b.head ? null : shapeResult(rows, b.single);
      break;
    }
    case "insert":
    case "upsert": {
      const rows = await runInsert(b.table, b.values, {
        uid,
        returning: b.returning,
        upsert: b.op === "upsert",
        onConflict: b.onConflict,
        ignoreDuplicates: b.ignoreDuplicates,
      });
      data = rows ? shapeResult(rows, b.single) : null;
      break;
    }
    case "update": {
      const rows = await runUpdate(b.table, b.values || {}, filters, { uid, returning: b.returning });
      data = rows ? shapeResult(rows, b.single) : null;
      break;
    }
    case "delete": {
      const rows = await runDelete(b.table, filters, { uid, returning: b.returning });
      data = rows ? shapeResult(rows, b.single) : null;
      break;
    }
    default:
      throw new ApiError(`Unbekannte Operation: ${b.op}`);
  }
  res.json({ data, count, error: null });
}));

app.post("/rest/rpc/:name", requireAuth, wrap(async (req, res) => {
  const data = await callRpc(req.params.name, req.uid, req.body || {});
  res.json({ data: data ?? null, error: null });
}));

// ------------------------------------------------------------------ KI
app.post("/ai/photo-scan", requireAuth, wrap(async (req, res) =>
  res.json({ data: await analyzeMealPhoto(req.uid, req.body), error: null })));

// ------------------------------------------------------------------ PDF
// Antwort bei Erfolg: das PDF selbst (application/pdf), bei Fehlern wie üblich { data, error }.
app.post("/pdf/cookbook", requireAuth, wrap(async (req, res) => {
  const pdf = await renderCookbookPdf(req.uid, req.body?.html);
  res.set("Content-Type", "application/pdf").set("Cache-Control", "no-store").send(pdf);
}));

// ------------------------------------------------------------------ Dateien
const raw = express.raw({ type: () => true, limit: "30mb" });

app.put("/storage/:bucket/*", requireAuth, raw, wrap(async (req, res) => {
  const path = await putObject(req.params.bucket, req.params[0], req.uid, req.body, req.headers["x-upsert"] === "true");
  res.json({ data: { path }, error: null });
}));

app.post("/storage/:bucket/sign", requireAuth, wrap(async (req, res) => {
  const { bucket } = req.params;
  const paths = req.body?.paths || [req.body?.path];
  const ttl = Math.min(Number(req.body?.expiresIn) || 3600, 7 * 86400);
  const out = [];
  for (const path of paths) {
    if (await canRead(bucket, path, req.uid)) {
      const token = signScoped({ b: bucket, p: path, k: "file" }, ttl);
      out.push({ path, signedUrl: `/storage/${bucket}/${encodeURI(path)}?token=${token}`, error: null });
    } else {
      out.push({ path, signedUrl: null, error: "Object not found" });
    }
  }
  res.json({ data: out, error: null });
}));

app.post("/storage/:bucket/remove", requireAuth, wrap(async (req, res) =>
  res.json({ data: await removeObjects(req.params.bucket, req.body?.paths || [], req.uid), error: null })));

app.post("/storage/:bucket/list", requireAuth, wrap(async (req, res) =>
  res.json({ data: await listObjects(req.params.bucket, req.body?.prefix || "", req.uid), error: null })));

app.get("/storage/:bucket/*", async (req, res) => {
  try {
    const { bucket } = req.params;
    const path = req.params[0];
    let allowed = false;
    if (req.query.token) {
      const t = verifyAccess(String(req.query.token));
      allowed = t.k === "file" && t.b === bucket && t.p === path;
    } else {
      const uid = verifyAccess((req.headers.authorization || "").slice(7)).sub;
      allowed = await canRead(bucket, path, uid);
    }
    if (!allowed) return res.status(403).json({ error: { message: "Kein Zugriff" } });
    const buf = await getObject(bucket, path);
    const ext = path.split(".").pop()?.toLowerCase();
    const types = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic" };
    res.set("Content-Type", types[ext] || "application/octet-stream");
    res.set("Cache-Control", "private, max-age=3600");
    res.send(buf);
  } catch (e) {
    res.status(e instanceof ApiError && e.code === "404" ? 404 : 401).json({ error: { message: e.message } });
  }
});

// ------------------------------------------------------------------ Konto löschen
app.post("/account/delete", requireAuth, wrap(async (req, res) => {
  await removeUserFiles(req.uid);
  await deleteUser(req.uid);
  res.json({ data: null, error: null });
}));

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => console.log(`Nutri-API läuft auf Port ${port}`));

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
