// Nitro setzt in .output/server/wrangler.json das heutige Systemdatum als
// compatibility_date. Steht die Systemuhr (wie in dieser Umgebung) in der
// Zukunft, lehnt Cloudflare den Deploy mit "Can't set compatibility date in
// the future" ab. Fixe es hier auf ein sicher vergangenes, festes Datum.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PATH = join(dirname(fileURLToPath(import.meta.url)), "..", ".output/server/wrangler.json");
const SAFE_DATE = "2024-09-23";

const config = JSON.parse(readFileSync(PATH, "utf8"));
config.compatibility_date = SAFE_DATE;
writeFileSync(PATH, JSON.stringify(config, null, 2));
console.log(`compatibility_date in ${PATH} auf ${SAFE_DATE} gesetzt.`);
