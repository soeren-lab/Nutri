"""Wandelt das Postgres-Schema (schema.sql aus dem Lovable-Dump) in MariaDB-DDL + schema.json um.

Aufruf: python convert_schema.py <export-ordner> <ausgabe-ordner>
Erzeugt: schema.mariadb.sql (nur Tabellen/Indizes/FKs) und schema.json (Spaltentypen,
Defaults, PKs, Relationen) für die API.
"""
import json
import re
import sys

export_dir, out_dir = sys.argv[1], sys.argv[2]
src = open(f"{export_dir}/schema.sql", encoding="utf-8", errors="replace").read()

TABLES = re.findall(r"CREATE TABLE public\.(\w+) \((.*?)\n\);", src, re.S)

# Postgres-Typ -> (Kurzname fuer die API, MariaDB-Typ)
def map_type(pg: str):
    pg = pg.strip()
    m = re.match(r"numeric\((\d+),(\d+)\)", pg)
    if m:
        return "num", f"DECIMAL({m.group(1)},{m.group(2)})"
    if pg == "numeric" or pg in ("double precision", "real"):
        return "num", "DOUBLE"
    if pg == "uuid":
        return "uuid", "CHAR(36)"
    if pg in ("integer", "smallint"):
        return "int", "INT"
    if pg == "bigint":
        return "int", "BIGINT"
    if pg == "boolean":
        return "bool", "TINYINT(1)"
    if pg == "date":
        return "date", "DATE"
    if pg.startswith("timestamp"):
        return "ts", "DATETIME(3)"
    if pg == "jsonb" or pg == "json":
        return "json", "LONGTEXT"
    if pg.endswith("[]"):
        return "arr", "LONGTEXT"
    if pg.startswith("character varying") or pg in ("text", "citext", "public.app_role"):
        return "text", "TEXT"
    raise SystemExit(f"Unbekannter Typ: {pg}")


def parse_default(expr: str, kind: str):
    e = expr.strip()
    if e == "gen_random_uuid()":
        return {"k": "uuid"}
    if e in ("now()", "CURRENT_TIMESTAMP", "timezone('utc'::text, now())"):
        return {"k": "now"}
    m = re.fullmatch(r"\(now\(\) \+ '(\d+):(\d+):(\d+)'::interval\)", e)
    if m:
        h, mi, se = (int(x) for x in m.groups())
        return {"k": "nowplus", "s": h * 3600 + mi * 60 + se}
    if e == "CURRENT_DATE":
        return {"k": "today"}
    if e in ("true", "false"):
        return {"k": "lit", "v": e == "true"}
    if re.fullmatch(r"-?\d+(\.\d+)?", e):
        return {"k": "lit", "v": float(e) if "." in e else int(e)}
    m = re.fullmatch(r"'(.*)'::(?:text|character varying|jsonb|json|date)(\[\])?", e, re.S)
    if m:
        v = m.group(1).replace("''", "'")
        if kind == "arr":
            return {"k": "lit", "v": [] if v == "{}" else v.strip("{}").split(",")}
        if kind == "json":
            return {"k": "lit", "v": json.loads(v)}
        return {"k": "lit", "v": v}
    m = re.fullmatch(r"\(?'(.*)'::(?:numeric|integer)\)?", e)
    if m:
        return {"k": "lit", "v": float(m.group(1))}
    if re.fullmatch(r"\(?-?\d+(\.\d+)?\)?::(?:numeric|integer)", e):
        return {"k": "lit", "v": float(re.sub(r"[()a-z:]", "", e))}
    print(f"  ! Default nicht uebersetzt: {e}", file=sys.stderr)
    return None


schema = {}
for tname, body in TABLES:
    cols = {}
    order = []
    for line in body.split("\n"):
        line = line.strip().rstrip(",")
        if not line or line.startswith("CONSTRAINT"):
            continue
        notnull = line.endswith(" NOT NULL")
        if notnull:
            line = line[: -len(" NOT NULL")]
        default = None
        if " DEFAULT " in line:
            line, default = line.split(" DEFAULT ", 1)
        name, pgtype = line.split(" ", 1)
        kind, my = map_type(pgtype)
        cols[name] = {
            "t": kind,
            "my": my,
            "nn": notnull,
            "d": parse_default(default, kind) if default else None,
        }
        order.append(name)
    schema[tname] = {"cols": cols, "order": order, "pk": [], "unique": [], "indexes": [], "fks": []}

for m in re.finditer(r"ALTER TABLE ONLY public\.(\w+)\s+ADD CONSTRAINT (\w+) (PRIMARY KEY|UNIQUE) \((.*?)\);", src, re.S):
    t, name, kind, cols = m.groups()
    cols = [c.strip() for c in cols.split(",")]
    if kind == "PRIMARY KEY":
        schema[t]["pk"] = cols
    else:
        schema[t]["unique"].append({"name": name[:60], "cols": cols})

for m in re.finditer(
    r"ALTER TABLE ONLY public\.(\w+)\s+ADD CONSTRAINT (\w+) FOREIGN KEY \((\w+)\) REFERENCES (?:public|auth)\.(\w+)\((\w+)\)([^;]*);",
    src,
):
    t, name, col, rt, rc, rest = m.groups()
    rt = "users" if rt == "users" else rt
    action = "NO ACTION"
    am = re.search(r"ON DELETE (CASCADE|SET NULL)", rest)
    if am:
        action = am.group(1)
    schema[t]["fks"].append({"name": name[:60], "col": col, "ref": rt, "refcol": rc, "onDelete": action})

for m in re.finditer(r"CREATE (UNIQUE )?INDEX (\w+) ON public\.(\w+) USING btree \((.*?)\)( WHERE .*?)?;", src):
    uniq, name, t, cols, where = m.groups()
    if t not in schema:
        continue
    # funktionale Indizes: lower(username) -> username (Spalte ist case-insensitive)
    cols = re.sub(r"lower\((\w+)\)", r"\1", cols)
    cols = re.sub(r" (DESC|ASC)", "", cols)
    colnames = [c.strip() for c in cols.split(",")]
    if uniq and where:
        if name == "user_profile_username_unique":
            schema[t]["unique"].append({"name": name[:60], "cols": colnames})
        else:
            print(f"  ! Partieller UNIQUE-Index uebersprungen: {name} (im Code absichern)", file=sys.stderr)
        continue
    schema[t]["indexes"].append({"name": name[:60], "cols": colnames})

# Spalten in Schluessel/Indizes muessen VARCHAR sein
for t, d in schema.items():
    keycols = set(d["pk"])
    for u in d["unique"]:
        keycols |= set(u["cols"])
    for i in d["indexes"]:
        keycols |= set(i["cols"])
    for f in d["fks"]:
        keycols.add(f["col"])
    for c in keycols:
        if d["cols"][c]["t"] == "text":
            d["cols"][c]["my"] = "VARCHAR(255)"

ddl = [
    "SET NAMES utf8mb4;",
    "SET FOREIGN_KEY_CHECKS=0;",
    # Eigene Benutzertabelle ersetzt auth.users.
    """CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `email_confirmed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_sign_in_at` DATETIME(3) NULL,
  `user_meta` LONGTEXT NULL,
  `app_meta` LONGTEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    """CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `token_hash` CHAR(64) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`token_hash`),
  KEY `refresh_tokens_user_idx` (`user_id`),
  CONSTRAINT `refresh_tokens_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    """CREATE TABLE IF NOT EXISTS `storage_objects` (
  `bucket` VARCHAR(64) NOT NULL,
  `path` VARCHAR(500) NOT NULL,
  `owner_id` CHAR(36) NULL,
  `mime` VARCHAR(100) NULL,
  `size` BIGINT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`bucket`, `path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
]

for t, d in schema.items():
    lines = []
    for c in d["order"]:
        col = d["cols"][c]
        lines.append(f"  `{c}` {col['my']} {'NOT NULL' if col['nn'] else 'NULL'}")
    if d["pk"]:
        lines.append("  PRIMARY KEY (" + ", ".join(f"`{c}`" for c in d["pk"]) + ")")
    for u in d["unique"]:
        lines.append(f"  UNIQUE KEY `{u['name']}` (" + ", ".join(f"`{c}`" for c in u["cols"]) + ")")
    for i in d["indexes"]:
        lines.append(f"  KEY `{i['name']}` (" + ", ".join(f"`{c}`" for c in i["cols"]) + ")")
    for f in d["fks"]:
        od = "" if f["onDelete"] == "NO ACTION" else f" ON DELETE {f['onDelete']}"
        lines.append(f"  CONSTRAINT `{f['name']}` FOREIGN KEY (`{f['col']}`) REFERENCES `{f['ref']}`(`{f['refcol']}`){od}")
    ddl.append(f"CREATE TABLE IF NOT EXISTS `{t}` (\n" + ",\n".join(lines) + "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;")

ddl.append("SET FOREIGN_KEY_CHECKS=1;")
open(f"{out_dir}/schema.mariadb.sql", "w", encoding="utf-8").write("\n\n".join(ddl) + "\n")
json.dump(schema, open(f"{out_dir}/schema.json", "w", encoding="utf-8"), indent=1)
print(f"{len(schema)} Tabellen umgewandelt")
