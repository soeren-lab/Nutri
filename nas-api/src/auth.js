import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { query, esc } from "./db.js";
import { ApiError } from "./query.js";

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  console.error("JWT_SECRET fehlt oder ist kürzer als 32 Zeichen – Abbruch.");
  process.exit(1);
}
const ACCESS_TTL = 60 * 60; // 1 Stunde
const REFRESH_TTL_DAYS = 90;

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const toSqlTs = (d) => d.toISOString().replace("T", " ").replace("Z", "");

export function publicUser(row) {
  const iso = (v) => (v ? String(v).replace(" ", "T") + "+00:00" : null);
  return {
    id: row.id,
    aud: "authenticated",
    role: "authenticated",
    email: row.email,
    email_confirmed_at: iso(row.email_confirmed_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    last_sign_in_at: iso(row.last_sign_in_at),
    app_metadata: row.app_meta ? JSON.parse(row.app_meta) : { provider: "email" },
    user_metadata: row.user_meta ? JSON.parse(row.user_meta) : {},
  };
}

export function signAccess(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: "authenticated" }, SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

export function verifyAccess(token) {
  return jwt.verify(token, SECRET);
}

export function signScoped(payload, ttlSeconds) {
  return jwt.sign(payload, SECRET, { expiresIn: ttlSeconds });
}

async function issueSession(userRow) {
  const refresh = randomBytes(48).toString("base64url");
  const expires = new Date(Date.now() + REFRESH_TTL_DAYS * 86400000);
  await query(
    `INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (${esc(sha256(refresh))}, ${esc(userRow.id)}, ${esc(toSqlTs(expires))})`,
  );
  await query(`UPDATE users SET last_sign_in_at = ${esc(toSqlTs(new Date()))} WHERE id = ${esc(userRow.id)}`);
  const access = signAccess(userRow);
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "bearer",
    expires_in: ACCESS_TTL,
    expires_at: Math.floor(Date.now() / 1000) + ACCESS_TTL,
    user: publicUser(userRow),
  };
}

const normEmail = (e) => String(e || "").trim().toLowerCase();

function checkPassword(pw) {
  if (typeof pw !== "string" || pw.length < 8) {
    throw new ApiError("Das Passwort muss mindestens 8 Zeichen lang sein.", "weak_password");
  }
}

export async function signUp({ email, password, data }) {
  email = normEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError("Ungültige E-Mail-Adresse", "invalid_email");
  checkPassword(password);
  const [exists] = await query(`SELECT id FROM users WHERE email = ${esc(email)}`);
  if (exists) throw new ApiError("User already registered", "user_already_exists");
  if (process.env.ALLOW_SIGNUP === "false") throw new ApiError("Registrierung ist deaktiviert", "signup_disabled");
  const id = randomUUID();
  const hash = await bcrypt.hash(password, 10);
  const now = toSqlTs(new Date());
  await query(
    `INSERT INTO users (id,email,password_hash,email_confirmed_at,created_at,updated_at,user_meta,app_meta) VALUES (${esc(id)},${esc(email)},${esc(hash)},${esc(now)},${esc(now)},${esc(now)},${esc(JSON.stringify(data || {}))},${esc(JSON.stringify({ provider: "email" }))})`,
  );
  const [row] = await query(`SELECT * FROM users WHERE id = ${esc(id)}`);
  return issueSession(row);
}

export async function signIn({ email, password }) {
  const [row] = await query(`SELECT * FROM users WHERE email = ${esc(normEmail(email))}`);
  // Immer vergleichen, damit die Antwortzeit nichts über die Existenz verrät.
  const ok = await bcrypt.compare(String(password || ""), row?.password_hash || "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi");
  if (!row || !ok) throw new ApiError("Invalid login credentials", "invalid_credentials");
  return issueSession(row);
}

export async function refresh(refreshToken) {
  const h = sha256(String(refreshToken || ""));
  const [tok] = await query(`SELECT * FROM refresh_tokens WHERE token_hash = ${esc(h)}`);
  if (!tok || new Date(tok.expires_at.replace(" ", "T") + "Z") < new Date()) {
    throw new ApiError("Invalid Refresh Token: Refresh Token Not Found", "refresh_token_not_found");
  }
  await query(`DELETE FROM refresh_tokens WHERE token_hash = ${esc(h)}`);
  const [row] = await query(`SELECT * FROM users WHERE id = ${esc(tok.user_id)}`);
  if (!row) throw new ApiError("User not found", "user_not_found");
  return issueSession(row);
}

export async function signOut(refreshToken, uid, all = false) {
  if (all && uid) await query(`DELETE FROM refresh_tokens WHERE user_id = ${esc(uid)}`);
  else if (refreshToken) await query(`DELETE FROM refresh_tokens WHERE token_hash = ${esc(sha256(refreshToken))}`);
}

export async function getUser(uid) {
  const [row] = await query(`SELECT * FROM users WHERE id = ${esc(uid)}`);
  if (!row) throw new ApiError("User not found", "user_not_found");
  return publicUser(row);
}

export async function updateUser(uid, { email, password, data }) {
  const sets = [];
  if (email) {
    email = normEmail(email);
    const [dupe] = await query(`SELECT id FROM users WHERE email = ${esc(email)} AND id <> ${esc(uid)}`);
    if (dupe) throw new ApiError("Diese E-Mail wird bereits verwendet", "email_exists");
    sets.push(`email = ${esc(email)}`);
  }
  if (password) {
    checkPassword(password);
    sets.push(`password_hash = ${esc(await bcrypt.hash(password, 10))}`);
  }
  if (data) {
    const [cur] = await query(`SELECT user_meta FROM users WHERE id = ${esc(uid)}`);
    const merged = { ...(cur?.user_meta ? JSON.parse(cur.user_meta) : {}), ...data };
    sets.push(`user_meta = ${esc(JSON.stringify(merged))}`);
  }
  if (sets.length) {
    sets.push(`updated_at = ${esc(toSqlTs(new Date()))}`);
    await query(`UPDATE users SET ${sets.join(", ")} WHERE id = ${esc(uid)}`);
  }
  return getUser(uid);
}

export async function deleteUser(uid) {
  await query(`DELETE FROM users WHERE id = ${esc(uid)}`);
}

/** Express-Middleware: setzt req.uid oder antwortet mit 401. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: { message: "Nicht angemeldet", code: "no_token" } });
  try {
    req.uid = verifyAccess(token).sub;
    next();
  } catch (e) {
    const expired = e?.name === "TokenExpiredError";
    res.status(401).json({ error: { message: expired ? "JWT expired" : "Invalid JWT", code: expired ? "jwt_expired" : "bad_jwt" } });
  }
}
