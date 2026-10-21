import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** Spaltentypen/Defaults/Relationen aus db/schema.json (von convert_schema.py erzeugt). */
export const schema = JSON.parse(
  readFileSync(process.env.SCHEMA_PATH || join(here, "..", "db", "schema.json"), "utf-8"),
);

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "nutri",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "nutri",
  charset: "utf8mb4",
  timezone: "Z",
  dateStrings: true,
  decimalNumbers: true,
  supportBigNumbers: true,
  bigNumberStrings: false,
  connectionLimit: 10,
  flags: ["+FOUND_ROWS"],
});

export const esc = (v) => mysql.escape(v);
export const escId = (id) => mysql.escapeId(id);

export async function query(sql, params = [], conn = pool) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

/** Transaktion mit eigener Verbindung. */
export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ---- Wert-Umwandlung zwischen JSON (App) und MariaDB ----

const pad = (n, l = 2) => String(n).padStart(l, "0");

export function toDbValue(kind, v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  switch (kind) {
    case "bool":
      return v === true || v === 1 || v === "true" ? 1 : 0;
    case "json":
    case "arr":
      return typeof v === "string" && kind === "json" && /^[\[{"]/.test(v) ? v : JSON.stringify(v);
    case "ts": {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) throw new Error(`Ungültiger Zeitstempel: ${v}`);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
    }
    case "date":
      return String(v).slice(0, 10);
    case "num":
    case "int":
      return typeof v === "string" && v.trim() !== "" ? Number(v) : v;
    default:
      return v;
  }
}

export function fromDbValue(kind, v) {
  if (v === null || v === undefined) return null;
  switch (kind) {
    case "bool":
      return Boolean(Number(v));
    case "json":
    case "arr":
      try {
        return typeof v === "string" ? JSON.parse(v) : v;
      } catch {
        return null;
      }
    case "ts":
      // "2026-10-21 17:44:00.123" -> ISO mit Offset wie bei Supabase
      return String(v).replace(" ", "T") + "+00:00";
    case "num":
    case "int":
      return typeof v === "string" ? Number(v) : v;
    default:
      return v;
  }
}

export function defaultFor(def) {
  if (!def) return undefined;
  switch (def.k) {
    case "uuid":
      return crypto.randomUUID();
    case "now":
      return new Date().toISOString();
    case "nowplus":
      return new Date(Date.now() + def.s * 1000).toISOString();
    case "today":
      return new Date().toISOString().slice(0, 10);
    case "lit":
      return def.v;
    default:
      return undefined;
  }
}
