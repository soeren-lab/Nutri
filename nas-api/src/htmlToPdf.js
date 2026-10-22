/**
 * HTML -> PDF mit Chromium (ohne JavaScript und ohne Netzwerk, siehe Sicherheitshinweis in
 * cookbookPdf.js) plus Schriften und das Umbruch-System der Kochbuch-Vorlage.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");
const PX_PER_MM = 96 / 25.4;
// Sicherheitsabstand beim Messen (mm), damit ein knapp passendes Rezept nicht doch umbricht.
const FIT_TOLERANCE_MM = 3;

let fontCssCache = null;
export function fontCss() {
  if (fontCssCache) return fontCssCache;
  const face = (family, file, weight, style = "normal") => {
    const b64 = readFileSync(join(FONT_DIR, file)).toString("base64");
    return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:${weight};font-style:${style};}`;
  };
  fontCssCache = [
    face("Cookbook Serif", "lora-latin-400-normal.woff2", 400),
    face("Cookbook Serif", "lora-latin-400-italic.woff2", 400, "italic"),
    face("Cookbook Serif", "lora-latin-700-normal.woff2", "600 700"),
    face("Cookbook Serif", "lora-latin-700-italic.woff2", "600 700", "italic"),
    face("Cookbook Sans", "sf-pro-display-regular.woff2", 400),
    face("Cookbook Sans", "sf-pro-display-medium.woff2", 500),
    face("Cookbook Sans", "sf-pro-display-bold.woff2", "600 700"),
  ].join("");
  return fontCssCache;
}

// Immer nur ein PDF gleichzeitig: Chromium braucht viel Arbeitsspeicher auf der NAS.
let queue = Promise.resolve();
function exclusive(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

/**
 * Umbruch-System (siehe Vorlage src/lib/cookbook-html.ts). Gemessen wird in Seitenbreite:
 * - Layout "seite": Ist ein Rezept höher als eine Seite, bekommt es die Klasse `flow`.
 * - Layout "doppelseite": Die Schrift der Text-Seite wird stufenweise verkleinert (--fs), bis
 *   sie auf eine Seite passt; reicht die kleinste Stufe nicht, fließt sie auf eine Folgeseite.
 */
async function applyLayoutFit(page) {
  const dims = await page.evaluate(() => ({
    w: Number(document.body.dataset.contentWidthMm),
    h: Number(document.body.dataset.contentHeightMm),
    minScale: Number(document.body.dataset.minScale) || 0.8,
  }));
  if (!dims.w || !dims.h) return;
  await page.emulateMediaType("print");
  await page.setViewport({ width: Math.round(dims.w * PX_PER_MM), height: 1200 });
  await page.evaluate(
    async (limitPx, minScale) => {
      await document.fonts.ready;
      for (const el of document.querySelectorAll(".recipe:not(.spread)")) {
        el.classList.remove("flow");
        if (el.getBoundingClientRect().height > limitPx) el.classList.add("flow");
      }
      for (const el of document.querySelectorAll(".spread .sp-text")) {
        let f = 1;
        el.style.setProperty("--fs", String(f));
        while (el.getBoundingClientRect().height > limitPx && f - 0.03 >= minScale - 1e-9) {
          f = Math.round((f - 0.03) * 100) / 100;
          el.style.setProperty("--fs", String(f));
        }
      }
    },
    (dims.h - FIT_TOLERANCE_MM) * PX_PER_MM,
    dims.minScale,
  );
}

export function renderHtmlToPdf(html) {
  return exclusive(async () => {
    const { default: puppeteer } = await import("puppeteer-core");
    const executablePath =
      process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--font-render-hinting=none"],
    });
    try {
      const page = await browser.newPage();
      await page.setJavaScriptEnabled(false); // Seiten-Skripte aus; evaluate() unten läuft trotzdem
      await page.setRequestInterception(true);
      page.on("request", (r) => {
        const u = r.url();
        if (u.startsWith("data:") || u === "about:blank") r.continue();
        else r.abort();
      });
      await page.setContent(html.replace("/*FONTS*/", fontCss()), { waitUntil: "load", timeout: 120000 });
      await applyLayoutFit(page);
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, timeout: 120000 });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => {});
    }
  });
}
