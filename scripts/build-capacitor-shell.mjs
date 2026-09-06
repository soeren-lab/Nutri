// Baut den lokalen Capacitor-webDir-Inhalt ("www/") aus dem Produktions-Build.
//
// Hintergrund: `bun run build` erzeugt in .output/public alle statischen
// Assets, aber TanStack Start rendert das HTML-Dokument selbst dynamisch pro
// Request über den Cloudflare Worker – es gibt keine fertige index.html.
// Damit die Capacitor-App komplett offline STARTEN kann (ohne Live-Request
// beim App-Start), holen wir das gerenderte Root-HTML einmal vom deployten
// Worker und speichern es als statische index.html dazu. Alle Asset-Pfade
// darin sind relativ (/assets/...), Supabase-Aufrufe laufen ohnehin über eine
// feste absolute URL – nur die vier serverfunktionsabhängigen Features
// (Konto löschen, PDF-Export, Freigabelink, OFF-Suche) bleiben bewusst
// "nicht verfügbar" in der App (siehe isNativeApp()-Guards).
//
// Ablauf für ein neues Release:
//   1. bun run build
//   2. cd .output/server && bunx wrangler deploy --config wrangler.json
//   3. bun run build-capacitor-shell
//   4. npx cap sync android && (Android Studio / gradlew assembleDebug)

import { cpSync, rmSync, writeFileSync, existsSync } from "node:fs";
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

const res = await fetch(WORKER_URL + "/");
if (!res.ok) {
  console.error(`Konnte ${WORKER_URL} nicht laden (Status ${res.status}). Ist der Worker deployt?`);
  process.exit(1);
}
const html = await res.text();

rmSync(WWW, { recursive: true, force: true });
cpSync(OUTPUT_PUBLIC, WWW, { recursive: true });
writeFileSync(join(WWW, "index.html"), html);

console.log(`www/ aktualisiert aus ${OUTPUT_PUBLIC} + gerendertem Root-HTML von ${WORKER_URL}`);
