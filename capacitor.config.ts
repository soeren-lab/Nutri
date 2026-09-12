import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.soeren.nutriapp",
  appName: "NUTRI",
  // Komplett lokal gebündelt (kein server.url) – die App startet dadurch
  // sofort, auch ganz ohne Internet. Supabase-Aufrufe laufen ohnehin über
  // eine feste externe URL. Die meisten POST-Server-Functions (Konto löschen,
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
};

export default config;
