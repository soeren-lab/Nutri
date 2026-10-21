# Archiv: alte Postgres-Migrationen

Diese 85 SQL-Dateien sind die Schema-Historie der früheren Lovable/Supabase-Datenbank (Postgres).
Sie werden **nicht mehr ausgeführt**. Maßgeblich ist heute das MariaDB-Schema in
`../schema.mariadb.sql` (erzeugt aus dem Dump mit `../../tools/convert_schema.py`).

Sie bleiben als Nachschlagewerk erhalten, zum Beispiel für die ursprünglichen Zugriffsregeln
(RLS-Policies), die in `nas-api/src/policies.js` nachgebaut sind.
