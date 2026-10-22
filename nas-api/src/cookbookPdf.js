/**
 * Kochbuch-PDF: Die App schickt das fertige HTML (src/lib/cookbook-html.ts) mit Bild-Verweisen der
 * Form storage://<bucket>/<pfad>. Hier werden die Bilder aus dem Datei-Speicher geholt (mit
 * Rechteprüfung), verkleinert und eingebettet, die Schriften ergänzt und das Ganze von Chromium
 * zu einem PDF gedruckt.
 *
 * Sicherheit: Das HTML stammt vom Client, daher läuft Chromium ohne JavaScript und ohne
 * Netzwerk (nur data:-URLs), und Bilder werden nur über storage://-Verweise mit canRead() geladen.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "./query.js";
import { BUCKETS, canRead, getObject } from "./storage.js";

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");
const MAX_HTML = 8_000_000;
const MAX_IMAGE_PX = 1400; // A4 mit rund 170 dpi
const JPEG_QUALITY = 78;
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

let fontCssCache = null;
function fontCss() {
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

/** Findet alle storage://-Verweise und ersetzt sie durch verkleinerte data:-URIs. */
export async function inlineImages(html, uid, loadImage = defaultLoadImage) {
  const refs = [...new Set(html.match(/storage:\/\/[a-z0-9_-]+\/[A-Za-z0-9._\/-]+/g) ?? [])];
  const resolved = new Map();
  let next = 0;
  async function worker() {
    while (next < refs.length) {
      const ref = refs[next++];
      try {
        resolved.set(ref, await loadImage(ref, uid));
      } catch (e) {
        console.error("[cookbook-pdf] Bild übersprungen", ref, e?.message);
        resolved.set(ref, BLANK);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, refs.length) }, worker));
  return html.replace(/storage:\/\/[a-z0-9_-]+\/[A-Za-z0-9._\/-]+/g, (m) => resolved.get(m) ?? BLANK);
}

async function defaultLoadImage(ref, uid) {
  const [, bucket, path] = ref.match(/^storage:\/\/([a-z0-9_-]+)\/(.+)$/);
  if (!BUCKETS.has(bucket)) throw new Error("Bucket unbekannt");
  if (!(await canRead(bucket, path, uid))) throw new Error("kein Zugriff");
  const buf = await getObject(bucket, path);
  const { default: sharp } = await import("sharp");
  const out = await sharp(buf)
    .rotate() // EXIF-Drehung übernehmen
    .resize({ width: MAX_IMAGE_PX, height: MAX_IMAGE_PX, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

// Immer nur ein PDF gleichzeitig: Chromium braucht viel Arbeitsspeicher auf der NAS.
let queue = Promise.resolve();
function exclusive(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
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
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on("request", (r) => {
        const u = r.url();
        if (u.startsWith("data:") || u === "about:blank") r.continue();
        else r.abort();
      });
      await page.setContent(html, { waitUntil: "load", timeout: 120000 });
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, timeout: 120000 });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => {});
    }
  });
}

export async function renderCookbookPdf(uid, html) {
  if (typeof html !== "string" || html.length < 50) throw new ApiError("Kochbuch-Inhalt fehlt", "400");
  if (html.length > MAX_HTML) throw new ApiError("Das Kochbuch ist zu groß für den Export", "413");
  if (!html.includes("/*FONTS*/")) throw new ApiError("Ungültige Kochbuch-Vorlage", "400");
  const withImages = await inlineImages(html, uid);
  try {
    return await renderHtmlToPdf(withImages.replace("/*FONTS*/", fontCss()));
  } catch (e) {
    console.error("[cookbook-pdf] Rendern fehlgeschlagen", e?.stack || e?.message);
    const detail = String(e?.message ?? "").replace(/\s+/g, " ").slice(0, 300);
    throw new ApiError(`Das PDF konnte auf dem Server nicht erstellt werden. (${detail})`, "500");
  }
}
