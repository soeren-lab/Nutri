// Baut die Android-APK mit der Version aus package.json.
//
//   bun run apk            -> synchronisiert Capacitor, setzt die Version, baut die Debug-APK und
//                              legt eine Kopie "NUTRI-<version>.apk" in Downloads\Nutri-Projekt.
//
// Die Version steht NUR in package.json ("version"). Daraus entstehen
//   versionName = "1.1.0"  und  versionCode = MAJOR*10000 + MINOR*100 + PATCH  (1.1.0 -> 10100).
// Der versionCode muss bei jedem Build steigen, damit Android ein Update über die alte App zulässt.

import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")).version;
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? "");
if (!m) throw new Error(`package.json: "version" muss MAJOR.MINOR.PATCH sein, ist aber "${version}"`);
const versionCode = Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);

// 1) Version in build.gradle schreiben
const gradlePath = join(root, "android", "app", "build.gradle");
let gradle = readFileSync(gradlePath, "utf-8");
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
writeFileSync(gradlePath, gradle);

// 2) Java finden (JAVA_HOME der Umgebung kann auf ein ungültiges Verzeichnis zeigen)
const candidates = [
  process.env.JAVA_HOME,
  "C:\\Program Files\\Android\\Android Studio\\jbr",
  join(homedir(), "AppData", "Local", "Programs", "Android Studio", "jbr"),
].filter(Boolean);
const javaHome = candidates.find((p) => existsSync(join(p, "bin", process.platform === "win32" ? "java.exe" : "java")));
if (!javaHome) throw new Error("Kein gültiges Java gefunden (JAVA_HOME bzw. Android Studio jbr).");
const env = { ...process.env, JAVA_HOME: javaHome };

// 3) Capacitor synchronisieren und bauen
const run = (cmd, cwd = root) => execSync(cmd, { cwd, env, stdio: "inherit" });
run("npx cap sync android");
const gradlew = join(root, "android", process.platform === "win32" ? "gradlew.bat" : "gradlew");
run(`"${gradlew}" clean assembleDebug`, join(root, "android"));

// 4) Kopie mit Versionsnamen an einen leicht auffindbaren Ort
const apk = join(root, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const outDir = process.env.NUTRI_APK_DIR ?? join(homedir(), "Downloads", "Nutri-Projekt");
mkdirSync(outDir, { recursive: true });
const target = join(outDir, `NUTRI-${version}.apk`);
copyFileSync(apk, target);
console.log(`\nAPK ${version} (versionCode ${versionCode}) -> ${target}`);
