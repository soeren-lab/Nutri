/**
 * Generische Abfrage-Engine mit PostgREST-ähnlicher Semantik:
 * select (inkl. eingebetteter Relationen), insert, update, delete, upsert – alles mit Zugriffsregeln.
 */
import { schema, query, esc, escId, toDbValue, fromDbValue, defaultFor } from "./db.js";
import { getPolicy } from "./policies.js";

export class ApiError extends Error {
  constructor(message, code = "400", details = null) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const MAX_ROWS = 1000;

function tableMeta(table) {
  const meta = schema[table];
  if (!meta) throw new ApiError(`Tabelle "${table}" nicht gefunden`, "42P01");
  return meta;
}

function colMeta(table, col) {
  const c = tableMeta(table).cols[col];
  if (!c) throw new ApiError(`Spalte "${col}" in "${table}" nicht gefunden`, "42703");
  return c;
}

// ------------------------------------------------------------------ select-Parser

function splitTop(str, sep = ",") {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export function parseSelect(str) {
  const out = { star: false, cols: [], embeds: [] };
  for (let raw of splitTop(str || "*")) {
    raw = raw.trim();
    if (!raw) continue;
    const par = raw.indexOf("(");
    if (par === -1) {
      if (raw === "*") out.star = true;
      else {
        const [a, b] = raw.includes(":") ? raw.split(":") : [null, raw];
        out.cols.push({ name: b.trim(), alias: a ? a.trim() : null });
      }
      continue;
    }
    const head = raw.slice(0, par);
    const inner = raw.slice(par + 1, raw.lastIndexOf(")")).trim();
    let alias = null;
    let rest = head;
    const ci = head.indexOf(":");
    if (ci !== -1) {
      alias = head.slice(0, ci).trim();
      rest = head.slice(ci + 1);
    }
    const parts = rest.trim().split("!");
    const embed = {
      table: parts[0],
      alias: alias || parts[0],
      hint: null,
      inner: false,
      count: inner === "count",
      children: null,
    };
    for (const p of parts.slice(1)) {
      if (p === "inner") embed.inner = true;
      else if (p === "left") embed.inner = false;
      else embed.hint = p;
    }
    if (!embed.count) embed.children = parseSelect(inner);
    out.embeds.push(embed);
  }
  return out;
}

// ------------------------------------------------------------------ Relationen

function resolveRelation(parent, embed) {
  const hintMatch = (fk) =>
    !embed.hint || fk.name === embed.hint.slice(0, 60) || fk.col === embed.hint;
  const m2o = schema[parent].fks.filter((fk) => fk.ref === embed.table && hintMatch(fk));
  const o2m = schema[embed.table]
    ? schema[embed.table].fks.filter((fk) => fk.ref === parent && hintMatch(fk))
    : [];
  if (embed.hint && m2o.length && o2m.length) {
    // Self-Reference o.ä.: der Hinweis nennt eine FK – ihre Richtung entscheidet.
    return { kind: "o2m", fk: o2m[0] };
  }
  if (m2o.length === 1 && !o2m.length) return { kind: "m2o", fk: m2o[0] };
  if (o2m.length && !m2o.length) return { kind: "o2m", fk: o2m[0] };
  if (m2o.length) return { kind: "m2o", fk: m2o[0] };
  throw new ApiError(
    `Keine Beziehung zwischen "${parent}" und "${embed.table}"`,
    "PGRST200",
  );
}

// ------------------------------------------------------------------ Filter

function valueFor(table, col, v) {
  const kind = colMeta(table, col).t;
  return toDbValue(kind, v);
}

function parseOrString(table, str) {
  const parts = splitTop(str);
  const clauses = [];
  for (const p of parts) {
    const m = p.match(/^([\w]+)\.(not\.)?(\w+)\.(.*)$/s);
    if (!m) throw new ApiError(`Ungültiger or-Filter: ${p}`);
    const [, col, neg, op, rest] = m;
    let val = rest;
    if (op === "in") val = splitTop(rest.replace(/^\(|\)$/g, "")).map((s) => s.replace(/^"|"$/g, ""));
    else if (op === "is") val = rest === "null" ? null : rest === "true" ? true : rest === "false" ? false : rest;
    clauses.push({ op: neg ? "not" : op, col, operator: neg ? op : undefined, val });
  }
  return clauses;
}

export function filterSql(table, f, alias = "t") {
  if (f.op === "or") {
    const inner = (typeof f.val === "string" ? parseOrString(table, f.val) : f.val).map((c) =>
      filterSql(table, c, alias),
    );
    return inner.length ? `(${inner.join(" OR ")})` : "1=1";
  }
  if (f.op === "match") {
    return (
      "(" +
      Object.entries(f.val)
        .map(([c, v]) => filterSql(table, { op: "eq", col: c, val: v }, alias))
        .join(" AND ") +
      ")"
    );
  }
  if (f.op === "not") {
    return `NOT (${filterSql(table, { op: f.operator, col: f.col, val: f.val }, alias)})`;
  }
  const col = `${alias}.${escId(f.col)}`;
  const kind = colMeta(table, f.col).t;
  const v = (x) => esc(toDbValue(kind, x));
  switch (f.op) {
    case "eq":
      return f.val === null ? `${col} IS NULL` : `${col} = ${v(f.val)}`;
    case "neq":
      return f.val === null ? `${col} IS NOT NULL` : `${col} <> ${v(f.val)}`;
    case "gt":
      return `${col} > ${v(f.val)}`;
    case "gte":
      return `${col} >= ${v(f.val)}`;
    case "lt":
      return `${col} < ${v(f.val)}`;
    case "lte":
      return `${col} <= ${v(f.val)}`;
    case "like":
    case "ilike":
      return `${col} LIKE ${esc(String(f.val).replace(/\*/g, "%"))}`;
    case "is":
      if (f.val === null) return `${col} IS NULL`;
      return `${col} = ${f.val === true || f.val === "true" ? 1 : 0}`;
    case "in": {
      const list = Array.isArray(f.val) ? f.val : [];
      return list.length ? `${col} IN (${list.map(v).join(",")})` : "1=0";
    }
    case "contains": {
      const arr = Array.isArray(f.val) ? f.val : [f.val];
      return arr.length
        ? "(" + arr.map((x) => `JSON_CONTAINS(${col}, ${esc(JSON.stringify(x))})`).join(" AND ") + ")"
        : "1=1";
    }
    default:
      throw new ApiError(`Filter "${f.op}" wird nicht unterstützt`);
  }
}

function orderSql(table, order, alias = "t") {
  if (!order?.length) return "";
  return (
    " ORDER BY " +
    order
      .map((o) => {
        colMeta(table, o.col);
        const c = `${alias}.${escId(o.col)}`;
        const asc = o.ascending !== false;
        // Postgres: NULL zählt als größter Wert (ASC -> zuletzt). MariaDB ist umgekehrt.
        const nullsFirst = o.nullsFirst ?? !asc;
        return `(${c} IS ${nullsFirst ? "NOT " : ""}NULL), ${c} ${asc ? "ASC" : "DESC"}`;
      })
      .join(", ")
  );
}

// ------------------------------------------------------------------ select

function convertRow(table, row) {
  const cols = schema[table].cols;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = cols[k] ? fromDbValue(cols[k].t, v) : v;
  }
  return out;
}

export async function runSelect(table, parsed, opts) {
  const { uid, filters = [], order, limit, offset, extraWhere = [] } = opts;
  const meta = tableMeta(table);
  const policy = getPolicy(table).select;
  if (!policy) return { rows: [], total: 0 };

  // Spaltenliste
  let selectList;
  const need = new Set();
  for (const e of parsed.embeds) {
    const rel = resolveRelation(table, e);
    need.add(rel.kind === "m2o" ? rel.fk.col : rel.fk.refcol);
  }
  if (parsed.star || (!parsed.cols.length && !parsed.embeds.length)) {
    selectList = "t.*";
  } else {
    const names = new Map();
    for (const c of parsed.cols) {
      colMeta(table, c.name);
      names.set(c.alias || c.name, `t.${escId(c.name)} AS ${escId(c.alias || c.name)}`);
    }
    for (const n of need) if (!names.has(n)) names.set(n, `t.${escId(n)}`);
    selectList = [...names.values()].join(", ");
    if (!names.size) selectList = "t.*";
  }

  const where = [policy("t", uid), ...filters.map((f) => filterSql(table, f)), ...extraWhere];
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const cap = Math.min(limit ?? MAX_ROWS, MAX_ROWS);
  const limitSql = ` LIMIT ${Number(cap)}${offset ? ` OFFSET ${Number(offset)}` : ""}`;

  const sql = `SELECT ${selectList} FROM ${escId(table)} AS t${whereSql}${orderSql(table, order)}${limitSql}`;
  let rows = (await query(sql)).map((r) => convertRow(table, r));

  let total = rows.length;
  if (opts.count) {
    const [{ c }] = await query(`SELECT COUNT(*) AS c FROM ${escId(table)} AS t${whereSql}`);
    total = Number(c);
  }

  for (const embed of parsed.embeds) {
    rows = await attachEmbed(table, rows, embed, uid);
  }
  return { rows, total };
}

async function attachEmbed(table, rows, embed, uid) {
  const rel = resolveRelation(table, embed);
  const alias = embed.alias;
  if (!rows.length) return rows;

  if (rel.kind === "m2o") {
    const keys = [...new Set(rows.map((r) => r[rel.fk.col]).filter((x) => x != null))];
    let byKey = new Map();
    if (keys.length) {
      const { rows: children } = await runSelect(embed.table, embed.children, {
        uid,
        extraWhere: [`t.${escId(rel.fk.refcol)} IN (${keys.map(esc).join(",")})`],
      });
      const refcol = rel.fk.refcol;
      byKey = new Map(children.map((c) => [c[refcol], c]));
    }
    for (const r of rows) r[alias] = byKey.get(r[rel.fk.col]) ?? null;
    return embed.inner ? rows.filter((r) => r[alias] != null) : rows;
  }

  // one-to-many
  const ids = [...new Set(rows.map((r) => r[rel.fk.refcol]).filter((x) => x != null))];
  const groups = new Map();
  if (ids.length) {
    if (embed.count) {
      const policy = getPolicy(embed.table).select;
      if (policy) {
        const res = await query(
          `SELECT t.${escId(rel.fk.col)} AS k, COUNT(*) AS c FROM ${escId(embed.table)} AS t WHERE ${policy("t", uid)} AND t.${escId(rel.fk.col)} IN (${ids.map(esc).join(",")}) GROUP BY t.${escId(rel.fk.col)}`,
        );
        for (const g of res) groups.set(g.k, [{ count: Number(g.c) }]);
      }
    } else {
      const { rows: children } = await runSelect(embed.table, embed.children, {
        uid,
        extraWhere: [`t.${escId(rel.fk.col)} IN (${ids.map(esc).join(",")})`],
        limit: MAX_ROWS,
      });
      for (const c of children) {
        const k = c[rel.fk.col];
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(c);
      }
    }
  }
  for (const r of rows) {
    r[alias] = groups.get(r[rel.fk.refcol]) ?? (embed.count ? [{ count: 0 }] : []);
  }
  return embed.inner ? rows.filter((r) => r[alias].length) : rows;
}

// ------------------------------------------------------------------ Mutationen

function buildDbRow(table, row, { withDefaults }) {
  const meta = tableMeta(table);
  const out = {};
  for (const k of Object.keys(row)) {
    if (!meta.cols[k]) throw new ApiError(`Spalte "${k}" in "${table}" nicht gefunden`, "PGRST204");
  }
  for (const name of meta.order) {
    const col = meta.cols[name];
    let v = row[name];
    if (v === undefined && withDefaults) v = defaultFor(col.d);
    if (v === undefined) continue;
    out[name] = toDbValue(col.t, v);
  }
  return out;
}

async function checkSql(table, kind, valuesByCol, uid, alias = "t") {
  const pol = getPolicy(table);
  const rule = kind === "insert" ? pol.insert : pol.update?.check;
  if (!rule) return false;
  const v = (col) => (col in valuesByCol ? esc(valuesByCol[col]) : kind === "update" ? `${alias}.${escId(col)}` : "NULL");
  const sql = rule(v, uid);
  if (kind === "insert") {
    const [r] = await query(`SELECT (${sql}) AS ok`);
    return Boolean(Number(r.ok));
  }
  return sql;
}

function pkWhere(table, rows, alias = "t") {
  const pk = tableMeta(table).pk;
  if (!pk.length) throw new ApiError(`Tabelle "${table}" hat keinen Primärschlüssel`);
  return (
    "(" +
    rows
      .map((r) => "(" + pk.map((c) => `${alias}.${escId(c)} = ${esc(r[c])}`).join(" AND ") + ")")
      .join(" OR ") +
    ")"
  );
}

async function selectBack(table, whereSql, returning, uid) {
  const parsed = returning === true ? parseSelect("*") : parseSelect(returning);
  const { rows } = await runSelect(table, parsed, { uid, extraWhere: [whereSql] });
  return rows;
}

const rlsError = (table) =>
  new ApiError(`new row violates row-level security policy for table "${table}"`, "42501");

export async function runInsert(table, rawRows, opts) {
  const { uid, returning, upsert, onConflict, ignoreDuplicates } = opts;
  const meta = tableMeta(table);
  const pol = getPolicy(table);
  if (!pol.insert) throw rlsError(table);
  const list = Array.isArray(rawRows) ? rawRows : [rawRows];
  if (!list.length) return [];

  const dbRows = [];
  const keyCols = upsert ? (onConflict?.length ? onConflict : meta.pk) : meta.pk;
  for (const raw of list) {
    const provided = new Set(Object.keys(raw));
    const dbRow = buildDbRow(table, raw, { withDefaults: true });
    if (table === "meal_plan_entries" && dbRow.date) {
      const created = (dbRow.created_at || new Date().toISOString()).slice(0, 10);
      dbRow.days_late = Math.max(0, Math.round((Date.parse(created) - Date.parse(dbRow.date)) / 86400000));
    }
    if (!(await checkSql(table, "insert", dbRow, uid))) throw rlsError(table);
    if (upsert && keyCols.length && keyCols.every((c) => dbRow[c] != null)) {
      // Existierende Zeile darf nur überschrieben werden, wenn sie dem User gehört.
      const where = keyCols.map((c) => `t.${escId(c)} = ${esc(dbRow[c])}`).join(" AND ");
      const [existing] = await query(`SELECT 1 AS x FROM ${escId(table)} AS t WHERE ${where} LIMIT 1`);
      if (existing) {
        const using = pol.update?.using;
        if (!using) throw rlsError(table);
        const [ok] = await query(
          `SELECT 1 AS x FROM ${escId(table)} AS t WHERE ${where} AND (${using("t", uid)}) LIMIT 1`,
        );
        if (!ok) throw rlsError(table);
      }
    }
    dbRows.push({ dbRow, provided });
  }

  // Gruppiert nach Spaltenmenge einfügen
  for (const { dbRow, provided } of dbRows) {
    const cols = Object.keys(dbRow);
    const colSql = cols.map(escId).join(",");
    const vals = cols.map((c) => esc(dbRow[c])).join(",");
    let sql;
    if (upsert && ignoreDuplicates) {
      sql = `INSERT IGNORE INTO ${escId(table)} (${colSql}) VALUES (${vals})`;
    } else if (upsert) {
      const upd = cols.filter((c) => provided.has(c) && !keyCols.includes(c));
      const updSql = upd.length
        ? upd.map((c) => `${escId(c)} = VALUES(${escId(c)})`).join(", ")
        : `${escId(keyCols[0] || cols[0])} = ${escId(keyCols[0] || cols[0])}`;
      sql = `INSERT INTO ${escId(table)} (${colSql}) VALUES (${vals}) ON DUPLICATE KEY UPDATE ${updSql}`;
      if (meta.cols.updated_at && !upd.includes("updated_at")) {
        sql += `, ${escId("updated_at")} = ${esc(toDbValue("ts", new Date().toISOString()))}`;
      }
    } else {
      sql = `INSERT INTO ${escId(table)} (${colSql}) VALUES (${vals})`;
    }
    await query(sql);
  }

  if (!returning) return null;
  const keyRows = dbRows.map((r) => r.dbRow);
  const useKeys = upsert && keyCols.length ? keyCols : meta.pk;
  const where =
    "(" +
    keyRows
      .map((r) => "(" + useKeys.map((c) => `t.${escId(c)} = ${esc(r[c])}`).join(" AND ") + ")")
      .join(" OR ") +
    ")";
  return selectBack(table, where, returning, uid);
}

export async function runUpdate(table, patch, filters, opts) {
  const { uid, returning } = opts;
  const meta = tableMeta(table);
  const pol = getPolicy(table);
  if (!pol.update?.using) throw rlsError(table);

  const dbPatch = buildDbRow(table, patch, { withDefaults: false });
  if (meta.cols.updated_at && !("updated_at" in dbPatch)) {
    dbPatch.updated_at = toDbValue("ts", new Date().toISOString());
  }
  const cols = Object.keys(dbPatch);
  if (!cols.length) return returning ? [] : null;

  const where = [pol.update.using("t", uid), ...filters.map((f) => filterSql(table, f))].join(" AND ");
  const matched = await query(
    `SELECT ${meta.pk.map((c) => `t.${escId(c)}`).join(",")} FROM ${escId(table)} AS t WHERE ${where}`,
  );
  if (!matched.length) return returning ? [] : null;

  const check = await checkSql(table, "update", dbPatch, uid);
  const setSql = cols.map((c) => `t.${escId(c)} = ${esc(dbPatch[c])}`).join(", ");
  const res = await query(
    `UPDATE ${escId(table)} AS t SET ${setSql} WHERE ${pkWhere(table, matched)}${check ? ` AND (${check})` : ""}`,
  );
  if (res.affectedRows < matched.length) throw rlsError(table);

  if (!returning) return null;
  // Neue PK-Werte, falls der Patch den Schlüssel geändert hat
  const keys = matched.map((r) => ({ ...r, ...Object.fromEntries(meta.pk.filter((c) => c in dbPatch).map((c) => [c, dbPatch[c]])) }));
  return selectBack(table, pkWhere(table, keys), returning, uid);
}

export async function runDelete(table, filters, opts) {
  const { uid, returning } = opts;
  const meta = tableMeta(table);
  const pol = getPolicy(table);
  if (!pol.delete) throw rlsError(table);
  const where = [pol.delete("t", uid), ...filters.map((f) => filterSql(table, f))].join(" AND ");
  const matched = await query(
    `SELECT ${meta.pk.map((c) => `t.${escId(c)}`).join(",")} FROM ${escId(table)} AS t WHERE ${where}`,
  );
  if (!matched.length) return returning ? [] : null;
  const back = returning ? await selectBack(table, pkWhere(table, matched), returning, uid) : null;
  await query(`DELETE t FROM ${escId(table)} AS t WHERE ${pkWhere(table, matched)}`);
  return back;
}

// ------------------------------------------------------------------ Fehler-Übersetzung

export function translateDbError(e) {
  if (e instanceof ApiError) return e;
  const msg = String(e?.sqlMessage || e?.message || e);
  switch (e?.errno) {
    case 1062: {
      const key = msg.match(/for key '(?:[\w.]+\.)?([\w]+)'/)?.[1] ?? "unique";
      return new ApiError(`duplicate key value violates unique constraint "${key}"`, "23505");
    }
    case 1451:
    case 1452:
      return new ApiError(`violates foreign key constraint: ${msg}`, "23503");
    case 1048:
      return new ApiError(`null value violates not-null constraint: ${msg}`, "23502");
    default:
      console.error("[db]", msg);
      return new ApiError(msg, "XX000");
  }
}

/** Antwort-Aufbereitung für einzelne Zeilen. */
export function shapeResult(rows, single) {
  if (!single) return rows;
  if (single === "maybe") {
    if (rows.length > 1) throw new ApiError("JSON object requested, multiple (or no) rows returned", "PGRST116");
    return rows[0] ?? null;
  }
  if (rows.length !== 1) throw new ApiError("JSON object requested, multiple (or no) rows returned", "PGRST116");
  return rows[0];
}
