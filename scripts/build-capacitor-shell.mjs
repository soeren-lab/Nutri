// Baut den lokalen Capacitor-webDir-Inhalt ("www/") aus dem Produktions-Build.
//
// Hintergrund: `bun run build` erzeugt in .output/public alle statischen
// Assets, aber TanStack Start rendert das HTML-Dokument selbst dynamisch pro
// Request über den Cloudflare Worker – es gibt keine fertige index.html.
// Damit die Capacitor-App komplett offline STARTEN kann (ohne Live-Request
// beim App-Start), holen wir das gerenderte Root-HTML einmal vom deployten
// Worker und speichern es als statische index.html dazu. Alle Asset-Pfade
// darin sind relativ (/assets/...), Daten-Aufrufe gehen ohnehin gegen die feste
// absolute NAS-API-Adresse (VITE_API_URL) – die meisten POST-Server-Functions (Konto löschen,
// PDF-Export, Kochbuch beitreten) bleiben bewusst "nicht verfügbar" in der
// App (siehe isNativeApp()-Guards); die unauthentifizierten GET-Functions
// (OFF-Suche, Kochbuch-Freigabelink) sowie zwei gezielt freigeschaltete
// POST-Functions (Push-Registrierung, Update-Broadcast) laufen stattdessen
// cross-origin gegen WORKER_URL (siehe src/lib/openfoodfacts.ts,
// src/lib/push-notifications.ts, src/server.ts).
//
// Ablauf für ein neues Release:
//   1. bun run build
//   2. cd .output/server && bunx wrangler deploy --config wrangler.json
//   3. bun run build-capacitor-shell
//   4. npx cap sync android && (Android Studio / gradlew assembleDebug)

import { cpSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKER_URL = "https://tanstack-start-ts.nutriapp.workers.dev";
const OUTPUT_PUBLIC = join(ROOT, ".output/public");
const WWW = join(ROOT, "www");

if (!existsSync(OUTPUT_PUBLIC)) {
  console.error(`${OUTPUT_PUBLIC} fehlt – zuerst 'bun run build' ausführen.`);
  process.exit(1);
}

/** Alle /assets/…-Dateien, auf die die Startseite verweist, müssen im neuen Build existieren. */
function missingAssets(html) {
  const refs = [...new Set(html.match(/\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g) ?? [])];
  return refs.filter((ref) => !existsSync(join(OUTPUT_PUBLIC, ref)));
}

// Direkt nach einem Deploy liefert Cloudflare kurz noch die alte Startseite aus. Deren Datei-Namen
// passen dann nicht zum neuen Build (weißer Bildschirm / "Etwas ist schiefgelaufen"). Deshalb
// wiederholen wir den Abruf, bis die Startseite zum Build passt.
let html = "";
let missing = [];
for (let attempt = 1; attempt <= 12; attempt++) {
  const res = await fetch(`${WORKER_URL}/?nocache=${Date.now()}`, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) {
    console.error(`Konnte ${WORKER_URL} nicht laden (Status ${res.status}). Ist der Worker deployt?`);
    process.exit(1);
  }
  html = await res.text();
  missing = missingAssets(html);
  if (missing.length === 0) break;
  console.log(`Startseite verweist noch auf alte Dateien (${missing.length}), neuer Versuch ${attempt}/12 …`);
  await sleep(5000);
}
if (missing.length > 0) {
  console.error(`Abbruch: Die Startseite vom Worker passt nicht zum Build. Fehlende Dateien: ${missing.join(", ")}`);
  process.exit(1);
}

rmSync(WWW, { recursive: true, force: true });
cpSync(OUTPUT_PUBLIC, WWW, { recursive: true });
writeFileSync(join(WWW, "index.html"), html);

console.log(`www/ aktualisiert aus ${OUTPUT_PUBLIC} + gerendertem Root-HTML von ${WORKER_URL}`);
