"""Wandelt die exportierten COPY-Dateien (pgdump_read.py) in INSERT-Statements für MariaDB um.

Aufruf: python make_data_sql.py <export-ordner> <schema.json> <ausgabe.sql>
Die Ausgabe enthält Passwort-Hashes und Nutzerdaten – NICHT in Git einchecken.
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

export_dir, schema_path, out_path = sys.argv[1:4]
schema = json.load(open(schema_path, encoding="utf-8"))


def unescape(v: str) -> str:
    if "\\" not in v:
        return v
    out, i = [], 0
    mp = {"b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t", "v": "\v", "\\": "\\"}
    while i < len(v):
        c = v[i]
        if c == "\\" and i + 1 < len(v):
            n = v[i + 1]
            if n in mp:
                out.append(mp[n])
                i += 2
                continue
        out.append(c)
        i += 1
    return "".join(out)


def sql_str(v: str) -> str:
    v = v.replace("\\", "\\\\").replace("'", "''").replace("\0", "")
    return "'" + v + "'"


def parse_pg_array(s: str):
    """'{a,"b c",NULL}' -> ['a','b c',None]"""
    s = s.strip()
    assert s[0] == "{" and s[-1] == "}", s
    s = s[1:-1]
    items, cur, i, inq, was_q = [], [], 0, False, False
    while i < len(s):
        c = s[i]
        if inq:
            if c == "\\":
                i += 1
                cur.append(s[i])
            elif c == '"':
                inq = False
            else:
                cur.append(c)
        elif c == '"':
            inq = was_q = True
        elif c == ",":
            t = "".join(cur)
            items.append(None if (t == "NULL" and not was_q) else t)
            cur, was_q = [], False
        else:
            cur.append(c)
        i += 1
    if cur or was_q or items:
        t = "".join(cur)
        items.append(None if (t == "NULL" and not was_q) else t)
    return items


def conv_ts(v: str) -> str:
    m = re.match(r"(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(\.\d+)?([+-]\d{2})(?::?(\d{2}))?$", v)
    if not m:
        raise ValueError(v)
    d, t, frac, oh, om = m.groups()
    dt = datetime.strptime(f"{d} {t}", "%Y-%m-%d %H:%M:%S")
    off = timedelta(hours=int(oh), minutes=int(om or 0) * (1 if int(oh) >= 0 else -1))
    dt = dt - off
    ms = int(((frac or ".0") + "000")[1:4])
    return dt.strftime("%Y-%m-%d %H:%M:%S") + f".{ms:03d}"


def convert(kind: str, v: str | None) -> str:
    if v is None:
        return "NULL"
    if kind == "bool":
        return "1" if v == "t" else "0"
    if kind in ("int", "num"):
        return v
    if kind == "ts":
        return sql_str(conv_ts(v))
    if kind == "arr":
        return sql_str(json.dumps(parse_pg_array(v), ensure_ascii=False))
    return sql_str(v)


def read_rows(fullname: str):
    hdr = open(os.path.join(export_dir, f"{fullname}.copyhdr.txt"), encoding="utf-8").read()
    cols = [c.strip().strip('"') for c in hdr[hdr.index("(") + 1 : hdr.index(")")].split(",")]
    raw = open(os.path.join(export_dir, f"{fullname}.copy.tsv"), "rb").read().decode("utf-8")
    rows = []
    for line in raw.split("\n"):
        if line == "\\." or line == "":
            continue
        parts = line.split("\t")
        rows.append([None if p == "\\N" else unescape(p) for p in parts])
    return cols, rows


out = open(out_path, "w", encoding="utf-8", newline="\n")
out.write("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET time_zone='+00:00';\n")
counts = {}

# --- Benutzer ---
cols, rows = read_rows("auth.users")
ix = {c: i for i, c in enumerate(cols)}
n = 0
for r in rows:
    ts = lambda c: sql_str(conv_ts(r[ix[c]])) if r[ix[c]] else "NULL"
    out.write(
        "INSERT INTO `users` (id,email,password_hash,email_confirmed_at,created_at,updated_at,last_sign_in_at,user_meta,app_meta) VALUES ("
        f"{sql_str(r[ix['id']])},{sql_str(r[ix['email']])},{sql_str(r[ix['encrypted_password']] or '')},"
        f"{ts('email_confirmed_at')},{ts('created_at')},{ts('updated_at')},{ts('last_sign_in_at')},"
        f"{sql_str(r[ix['raw_user_meta_data']]) if r[ix['raw_user_meta_data']] else 'NULL'},"
        f"{sql_str(r[ix['raw_app_meta_data']]) if r[ix['raw_app_meta_data']] else 'NULL'});\n"
    )
    n += 1
counts["users"] = n

# --- public.* ---
for t, d in schema.items():
    fn = f"public.{t}"
    if not os.path.exists(os.path.join(export_dir, f"{fn}.copy.tsv")):
        continue
    cols, rows = read_rows(fn)
    n = 0
    for r in rows:
        if len(r) != len(cols):
            print(f"! {t}: Zeile mit {len(r)} statt {len(cols)} Spalten uebersprungen", file=sys.stderr)
            continue
        vals = [convert(d["cols"][c]["t"], v) for c, v in zip(cols, r)]
        out.write(f"INSERT INTO `{t}` (" + ",".join(f"`{c}`" for c in cols) + ") VALUES (" + ",".join(vals) + ");\n")
        n += 1
    counts[t] = n

out.write("SET FOREIGN_KEY_CHECKS=1;\n")
out.close()
print(json.dumps({k: v for k, v in counts.items() if v}, indent=0))
