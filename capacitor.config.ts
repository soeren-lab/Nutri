import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.soeren.nutriapp",
  appName: "NUTRI",
  // Komplett lokal gebündelt (kein server.url) – die App startet dadurch
  // sofort, auch ganz ohne Internet. Daten-Aufrufe gehen ohnehin gegen die feste
  // NAS-API-Adresse (VITE_API_URL). Die meisten POST-Server-Functions (Konto löschen,
  // PDF-Export, Kochbuch beitreten) bleiben bewusst "nicht verfügbar" in der
  // App (isNativeApp()-Guards) – die unauthentifizierten GET-Functions
  // (OFF-Suche, Kochbuch-Freigabelink) sowie zwei gezielt freigeschaltete
  // POST-Functions (Push-Registrierung, Update-Broadcast) rufen stattdessen
  // die absolute Worker-URL cross-origin auf (siehe openfoodfacts.ts,
  // push-notifications.ts, src/server.ts).
  //
  // Neues Release: 1) bun run build  2) cd .output/server && bunx wrangler
  // deploy --config wrangler.json  3) bun run build-capacitor-shell
  // 4) npx cap sync android
  webDir: "www",
  // Die NAS-API läuft im Heimnetz per http://<NAS-IP>:3000 (kein TLS). Die App-Oberfläche
  // wird intern über localhost ausgeliefert (siehe server.androidScheme).
  android: {
    allowMixedContent: true,
  },
  // Die App läuft intern auf http://localhost statt https://localhost. Sonst blockiert Android
  // Bilder von der NAS (http://<NAS-IP>:3000) als "Mixed Content", auch mit allowMixedContent.
  server: {
    androidScheme: "http",
  },
};

export default config;
