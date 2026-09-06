import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.soeren.nutriapp',
  appName: 'NUTRI',
  // Komplett lokal gebündelt (kein server.url) – die App startet dadurch
  // sofort, auch ganz ohne Internet. Supabase-Aufrufe laufen ohnehin über
  // eine feste externe URL. Nur die vier serverfunktionsabhängigen Features
  // (Konto löschen, PDF-Export, Freigabelink, OFF-Suche) bleiben bewusst
  // "nicht verfügbar" in der App (isNativeApp()-Guards).
  //
  // Neues Release: 1) bun run build  2) cd .output/server && bunx wrangler
  // deploy --config wrangler.json  3) bun run build-capacitor-shell
  // 4) npx cap sync android
  webDir: 'www',
};

export default config;
