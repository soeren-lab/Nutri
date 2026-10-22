// Rauchtest der PDF-Kette (braucht Chrome: CHROME_PATH setzen). Aufruf: npm run test:pdf
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { inlineImages, renderHtmlToPdf } from "../src/cookbookPdf.js";

const img = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#b4532a" } }).jpeg().toBuffer();
const loadImage = async (ref) => {
  assert.match(ref, /^storage:\/\/recipe-images\//);
  const out = await sharp(img).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
};

const html = `<!doctype html><html><head><meta charset="utf-8"><style>/*FONTS*/
@page{size:A4;margin:20mm} body{font:12pt "Cookbook Serif",serif}
.h{height:50mm;background:url('storage://recipe-images/u/x.jpg') center/cover}</style></head>
<body><div class="h"></div><p>Grüße aus Äpfeln & Öl</p><img src="http://example.invalid/x.png"></body></html>`;

const inlined = await inlineImages(html, "u", loadImage);
assert.ok(!inlined.includes("storage://"));
assert.ok(inlined.includes("data:image/jpeg;base64,"));

const pdf = await renderHtmlToPdf(inlined.replace("/*FONTS*/", ""));
assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
console.log(`ok – PDF ${Math.round(pdf.length / 1024)} KB`);
