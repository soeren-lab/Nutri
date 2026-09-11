// Nitro setzt in .output/server/wrangler.json das heutige Systemdatum als
// compatibility_date. Steht die Systemuhr (wie in dieser Umgebung) in der
// Zukunft, lehnt Cloudflare den Deploy mit "Can't set compatibility date in
// the future" ab. Fixe es hier auf ein sicher vergangenes, festes Datum.
//
// Nitro leitet den Worker-Namen automatisch her, wenn keiner fest konfiguriert
// ist – u.a. vom git-Remote-Namen. Seit das Repo mit GitHub verbunden ist,
// kippt der Name dadurch von "tanstack-start-ts" auf sowas wie
// "soeren-lab-nutri" um, was einen ZWEITEN, separaten Worker anlegen würde
// statt den bestehenden (an den die App/PWA-URL gebunden ist) zu aktualisieren.
// Deshalb hier ebenfalls fest zurücksetzen.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PATH = join(dirname(fileURLToPath(import.meta.url)), "..", ".output/server/wrangler.json");
const SAFE_DATE = "2024-09-23";
const WORKER_NAME = "tanstack-start-ts";

const config = JSON.parse(readFileSync(PATH, "utf8"));
config.compatibility_date = SAFE_DATE;
config.name = WORKER_NAME;
writeFileSync(PATH, JSON.stringify(config, null, 2));
console.log(`compatibility_date in ${PATH} auf ${SAFE_DATE} gesetzt, Worker-Name auf "${WORKER_NAME}" fixiert.`);
