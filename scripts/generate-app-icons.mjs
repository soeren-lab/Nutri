// Erzeugt alle App-Icon-Dateien (PWA + Android) aus einer einzigen Quelldatei.
// Quelle: app-icon-upload/icon.png (siehe app-icon-upload/LIESMICH.txt)
// Aufruf: bun run generate-icons

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "app-icon-upload/icon.png");
const BACKGROUND = "#4F46E5"; // Indigo — Sicherheitszone für maskierbare/adaptive Icons

if (!existsSync(SOURCE)) {
  console.error(
    `Keine Quelldatei gefunden: ${SOURCE}\n` +
      "Bitte dein Icon dort als 'icon.png' ablegen — siehe app-icon-upload/LIESMICH.txt.",
  );
  process.exit(1);
}

/** Skaliert die Quelle randlos (deckend) auf die volle Kachelgröße. */
async function edgeToEdge(size, targetPath) {
  await mkdir(dirname(targetPath), { recursive: true });
  await sharp(SOURCE)
    .resize(size, size, { fit: "cover", position: "centre" })
    .flatten({ background: BACKGROUND })
    .png()
    .toFile(targetPath);
}

/**
 * Verkleinert die Quelle auf `scale` der Kachelgröße und zentriert sie auf
 * einer Fläche mit `background` (oder transparent) — für maskierbare/adaptive
 * Icon-Varianten, deren Rand vom System weggeschnitten werden kann.
 */
async function safeZoneOnColor(size, scale, targetPath, { transparentBackground = false } = {}) {
  await mkdir(dirname(targetPath), { recursive: true });
  const inner = Math.round(size * scale);
  const foreground = await sharp(SOURCE)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: transparentBackground ? { r: 0, g: 0, b: 0, alpha: 0 } : BACKGROUND,
    },
  })
    .composite([{ input: foreground, gravity: "centre" }])
    .png()
    .toFile(targetPath);
}

const pub = (name) => join(ROOT, "public", name);
const android = (dir, name) =>
  join(ROOT, "android/app/src/main/res", dir, name);

async function main() {
  // PWA — randlos
  await edgeToEdge(180, pub("apple-touch-icon.png"));
  await edgeToEdge(64, pub("favicon.png"));
  await edgeToEdge(192, pub("pwa-192.png"));
  await edgeToEdge(512, pub("pwa-512.png"));

  // PWA — maskierbar (80% Sicherheitszone, deckender Indigo-Hintergrund)
  await safeZoneOnColor(192, 0.8, pub("pwa-maskable-192.png"));
  await safeZoneOnColor(512, 0.8, pub("pwa-maskable-512.png"));

  // Android — je Dichte: legacy (randlos) + round (randlos) + adaptive foreground (66%, transparent)
  const densities = [
    { dir: "mipmap-mdpi", legacy: 48, fg: 108 },
    { dir: "mipmap-hdpi", legacy: 72, fg: 162 },
    { dir: "mipmap-xhdpi", legacy: 96, fg: 216 },
    { dir: "mipmap-xxhdpi", legacy: 144, fg: 324 },
    { dir: "mipmap-xxxhdpi", legacy: 192, fg: 432 },
  ];

  for (const { dir, legacy, fg } of densities) {
    await edgeToEdge(legacy, android(dir, "ic_launcher.png"));
    await edgeToEdge(legacy, android(dir, "ic_launcher_round.png"));
    await safeZoneOnColor(fg, 0.66, android(dir, "ic_launcher_foreground.png"), {
      transparentBackground: true,
    });
  }

  console.log("Icons erzeugt: public/*.png + android/app/src/main/res/mipmap-*/*.png");
}

main();
