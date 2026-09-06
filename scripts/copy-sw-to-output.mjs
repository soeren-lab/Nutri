// vite-plugin-pwa generiert den Service Worker (sw.js + workbox-*.js) in
// Vites eigenem Standard-Ausgabeordner ("dist/"), weil es Vites
// build.outDir nutzt und nichts von TanStack Starts/Nitros zusätzlicher
// Konsolidierung nach ".output/public" weiß. Nitro kopiert diese vom Plugin
// nachträglich (per writeBundle-Hook, außerhalb von Vites Manifest)
// erzeugten Dateien nicht automatisch mit – ohne diesen Schritt bekommt
// jeder Client (Web wie die per Capacitor gebündelte App) für "/sw.js"
// dauerhaft einen 404, und die gesamte Offline-Bildercache-Funktionalität
// (vite.config.ts, Workbox-Regeln) läuft nie tatsächlich.
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const OUTPUT_PUBLIC = join(ROOT, ".output/public");

if (!existsSync(DIST)) {
  console.error(`${DIST} fehlt – vite-plugin-pwa hat keinen Service Worker erzeugt?`);
  process.exit(1);
}
if (!existsSync(OUTPUT_PUBLIC)) {
  console.error(`${OUTPUT_PUBLIC} fehlt – zuerst 'bun run build' ausführen.`);
  process.exit(1);
}

const files = readdirSync(DIST).filter((f) => f === "sw.js" || f.startsWith("workbox-"));
if (files.length === 0) {
  console.warn(`Keine sw.js/workbox-*.js in ${DIST} gefunden – nichts zu kopieren.`);
  process.exit(0);
}

for (const file of files) {
  copyFileSync(join(DIST, file), join(OUTPUT_PUBLIC, file));
}
console.log(`${files.join(", ")} von dist/ nach ${OUTPUT_PUBLIC} kopiert.`);
