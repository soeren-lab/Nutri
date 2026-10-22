/**
 * Vorschau der Kochbuch-Vorlage: baut mit Beispieldaten ein HTML und lässt Chrome/Edge daraus
 * ein PDF drucken. Aufruf (im Projektordner):
 *
 *   bun scripts/cookbook-preview.ts [Ausgabeordner] [Bild1.jpg Bild2.jpg …]
 *
 * Ohne Bilder zeigt die Vorschau die Seiten ohne Fotos. Chrome wird automatisch gesucht
 * (oder per CHROME_PATH angeben).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderCookbookHtml, type CookbookDoc } from "../src/lib/cookbook-html";

const out = resolve(process.argv[2] ?? "scratchpad/cookbook-preview");
const images = process.argv.slice(3).map((f) => {
  const ext = f.toLowerCase().endsWith(".png") ? "png" : "jpeg";
  return `data:image/${ext};base64,${readFileSync(f).toString("base64")}`;
});
const img = (i: number) => (images.length ? images[i % images.length] : null);

const doc: CookbookDoc = {
  title: "Meal Prep für die Woche",
  description: "Einfache Rezepte mit viel Eiweiß, die sich gut vorbereiten lassen.",
  cover: img(0),
  recipes: [
    {
      title: "Nudelauflauf mit Schinken und Käse",
      description:
        "Cremiger Klassiker aus dem Ofen, der sich prima vorbereiten und aufwärmen lässt.",
      image: img(1),
      categories: ["Hauptgericht", "Auflauf"],
      totalMinutes: 55,
      servings: 4,
      sections: [
        {
          title: null,
          ingredients: [
            { amount: "400 g", name: "Penne" },
            { amount: "200 g", name: "Kochschinken, gewürfelt" },
            { amount: "150 g", name: "geriebener Gouda" },
            { amount: "1 Stück", name: "Zwiebel" },
          ],
        },
        {
          title: "Sauce",
          ingredients: [
            { amount: "250 ml", name: "Sahne" },
            { amount: "200 ml", name: "Milch" },
            { amount: "2 EL", name: "Mehl" },
            { amount: "1 Prise", name: "Muskat" },
          ],
        },
      ],
      steps: [
        "Backofen auf 200 °C Ober-/Unterhitze vorheizen. Die Nudeln in reichlich Salzwasser bissfest kochen und abgießen.",
        "Die Zwiebel fein würfeln und in etwas Butter glasig dünsten. Mit Mehl bestäuben, kurz anschwitzen und mit Milch und Sahne ablöschen. Unter Rühren aufkochen und mit Salz, Pfeffer und Muskat abschmecken.",
        "Nudeln, Schinken und die Hälfte des Käses mit der Sauce vermengen und in eine gefettete Auflaufform geben.",
        "Mit dem restlichen Käse bestreuen und ca. 25 Minuten goldbraun überbacken.",
      ],
      nutrition: { kcal: 742, fat_g: 31.4, carbs_g: 76.2, fiber_g: 4.1, protein_g: 33.8 },
    },
    {
      title: "Skyr-Bowl mit Beeren",
      description: null,
      image: img(2),
      categories: ["Frühstück"],
      totalMinutes: 5,
      servings: 1,
      sections: [
        {
          title: null,
          ingredients: [
            { amount: "250 g", name: "Skyr natur" },
            { amount: "100 g", name: "Beerenmischung" },
            { amount: "30 g", name: "Haferflocken" },
          ],
        },
      ],
      steps: ["Skyr in eine Schüssel geben, Beeren und Haferflocken darübergeben und servieren."],
      nutrition: { kcal: 310, fat_g: 3.2, carbs_g: 38, fiber_g: 5.5, protein_g: 31 },
    },
    {
      title:
        "Chili con Carne – das große Meal-Prep-Rezept für die ganze Woche mit extra viel Gemüse",
      description: "Würzig, sättigend und perfekt zum Vorkochen.",
      image: null,
      categories: ["Hauptgericht"],
      totalMinutes: 95,
      servings: 6,
      sections: [
        {
          title: null,
          ingredients: Array.from({ length: 12 }, (_, i) => ({
            amount: `${(i + 1) * 25} g`,
            name: [
              "Rinderhack",
              "Kidneybohnen",
              "Mais",
              "Paprika",
              "Tomaten, gehackt",
              "Zwiebel",
              "Knoblauch",
              "Tomatenmark",
              "Chili",
              "Kreuzkümmel",
              "Paprikapulver",
              "Brühe",
            ][i],
          })),
        },
      ],
      steps: Array.from(
        { length: 9 },
        (_, i) =>
          `Schritt ${i + 1}: Dies ist ein längerer Beispieltext, der zeigt, wie sich die Zubereitung über mehrere Zeilen und notfalls über eine zweite Seite verteilt, ohne dass ein Schritt mittendrin zerrissen wird.`,
      ),
      nutrition: { kcal: 520, fat_g: 18, carbs_g: 48, fiber_g: 14, protein_g: 38 },
    },
  ],
};

mkdirSync(out, { recursive: true });
const htmlFile = resolve(out, "kochbuch.html");
const pdfFile = resolve(out, "kochbuch.pdf");
const fontDir = resolve("nas-api/assets/fonts");
const face = (family: string, file: string, weight: string, style = "normal") =>
  `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${readFileSync(resolve(fontDir, file)).toString("base64")}) format("woff2");font-weight:${weight};font-style:${style};}`;
const fontCss = [
  face("Cookbook Serif", "lora-latin-400-normal.woff2", "400"),
  face("Cookbook Serif", "lora-latin-400-italic.woff2", "400", "italic"),
  face("Cookbook Serif", "lora-latin-700-normal.woff2", "600 700"),
  face("Cookbook Serif", "lora-latin-700-italic.woff2", "600 700", "italic"),
  face("Cookbook Sans", "sf-pro-display-regular.woff2", "400"),
  face("Cookbook Sans", "sf-pro-display-medium.woff2", "500"),
  face("Cookbook Sans", "sf-pro-display-bold.woff2", "600 700"),
].join("");
writeFileSync(htmlFile, renderCookbookHtml(doc, { fontCss }));

const candidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean) as string[];
const chrome = candidates.find((c) => existsSync(c));
if (!chrome) throw new Error("Kein Chrome/Edge gefunden. Pfad per CHROME_PATH angeben.");

execFileSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--user-data-dir=${resolve(out, ".chrome-profile")}`,
    `--print-to-pdf=${pdfFile}`,
    pathToFileURL(htmlFile).href,
  ],
  { stdio: "ignore", timeout: 60000 },
);
console.log(`PDF: ${pdfFile}`);
