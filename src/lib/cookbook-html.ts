/**
 * Digitales Kochbuch als Code: baut aus Kochbuch-Daten ein vollständiges HTML-Dokument mit
 * Druck-CSS (@page). Chromium auf der NAS macht daraus das PDF (siehe nas-api, /pdf/render).
 *
 * Die Funktion ist rein (keine Imports, kein Zugriff auf Daten/Netz) und lässt sich lokal
 * ausprobieren: `bun scripts/cookbook-preview.ts` erzeugt Beispielseiten als PDF.
 *
 * ALLE Gestaltungs-Stellschrauben stehen oben in `DESIGN`: Seitenformat, Ränder, Farben,
 * Schriften, Schriftgrößen, Abstände. Texte werden immer maskiert (`esc`).
 */

// ------------------------------------------------------------------ Daten (fertig formatiert)

export type CookbookIngredient = {
  /** z. B. "250 g", "2 Stück" oder leer */
  amount: string;
  name: string;
};

export type CookbookSection = {
  /** Überschrift der Gruppe (Komponente, z. B. "Sauce"); null = ohne Überschrift */
  title: string | null;
  ingredients: CookbookIngredient[];
};

export type CookbookNutrition = {
  kcal: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  protein_g: number;
};

export type CookbookRecipe = {
  title: string;
  description?: string | null;
  /** Bildquelle (data:-URI oder storage://bucket/pfad, vom Server aufgelöst) */
  image?: string | null;
  categories: string[];
  /** Gesamtzeit in Minuten (Vorbereitung + Kochen) */
  totalMinutes: number | null;
  servings: number | null;
  sections: CookbookSection[];
  steps: string[];
  /** pro Portion; null = nicht anzeigen */
  nutrition: CookbookNutrition | null;
};

export type CookbookDoc = {
  title: string;
  description?: string | null;
  cover?: string | null;
  recipes: CookbookRecipe[];
};

// ------------------------------------------------------------------ Gestaltung

export const DESIGN = {
  /**
   * Rezept-Layout:
   *  "seite"       – eine Seite pro Rezept (Foto oben, Zutaten links, Schritte rechts); lange Rezepte
   *                  wechseln automatisch in ein fließendes Layout.
   *  "doppelseite" – wie im gedruckten Kochbuch: Foto-Seite + Text-Seite (Zutaten in Spalten, Schritte
   *                  in zwei Spalten, Schrift schrumpft automatisch bis alles auf die Seite passt).
   */
  layout: "doppelseite" as "seite" | "doppelseite",
  /** Doppelseite: Höhe des Fotos in mm, kleinste erlaubte Schrift (Faktor), Spalten der Schritte */
  spread: { photoHeight: 175, minScale: 0.78, stepColumns: 2 },
  /** Seitengröße in mm (A4 = 210 × 297, A5 = 148 × 210) */
  page: { width: 210, height: 297 },
  /** Ränder in mm (oben, rechts, unten, links) */
  margin: { top: 22, right: 18, bottom: 22, left: 18 },
  color: {
    paper: "#faf6ee",
    ink: "#2b2118",
    muted: "#7a6a58",
    rule: "#d9ccb4",
    accent: "#b4532a",
    card: "#f2ead9",
  },
  font: {
    // Eingebettete Schriften (Server liefert sie als @font-face), danach Systemschriften.
    serif: `"Cookbook Serif", Georgia, "Times New Roman", serif`,
    sans: `"Cookbook Sans", "SF Pro Display", "Segoe UI", Arial, sans-serif`,
  },
  /** Schriftgrößen in pt */
  size: {
    body: 10.5,
    small: 8.5,
    label: 8,
    recipeTitle: 30,
    sectionTitle: 13,
    coverTitle: 44,
  },
  /** Höhe des Rezeptbilds in mm */
  heroHeight: 46,
  /** Breite der Zutaten-Spalte in mm */
  ingredientsWidth: 66,
  radius: 3,
} as const;

// ------------------------------------------------------------------ Hilfen

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (s: string | number | null | undefined): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** Nur sichere Bildquellen zulassen (kein javascript:, kein http: – Chromium blockt Netz ohnehin). */
function safeSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(src)) return src;
  if (/^storage:\/\/[a-z0-9_-]+\/[A-Za-z0-9._/-]+$/.test(src)) return src;
  return null;
}

export function formatMinutes(min: number | null | undefined): string {
  if (!min || min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} Min`;
  return m === 0 ? `${h} Std` : `${h} Std ${m} Min`;
}

const nf = (n: number, digits = 0) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// ------------------------------------------------------------------ CSS

/** Text als CSS-String-Literal (für `content:`). */
const cssStr = (s: string) => `"${s.replace(/[\\"]/g, "\\$&").replace(/[\r\n]+/g, " ")}"`;

function css(bookTitle: string): string {
  const d = DESIGN;
  const m = d.margin;
  return `
@page {
  size: ${d.page.width}mm ${d.page.height}mm;
  margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;
  background: ${d.color.paper};
  @top-left { content: ${cssStr(bookTitle)}; font: italic ${d.size.small}pt ${d.font.serif}; color: ${d.color.muted}; vertical-align: bottom; padding-bottom: 4mm; }
  @bottom-center { content: counter(page); font: ${d.size.small}pt ${d.font.serif}; color: ${d.color.muted}; vertical-align: top; padding-top: 5mm; }
}
@page cover { margin: 0; @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; } }

* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0; color: ${d.color.ink}; background: ${d.color.paper};
  font: ${d.size.body}pt/1.5 ${d.font.serif};
  hyphens: auto; -webkit-hyphens: auto;
}

/* ---------- Titelseite ---------- */
.cover { page: cover; break-after: page; height: ${d.page.height}mm; width: ${d.page.width}mm; position: relative; background: ${d.color.paper}; overflow: hidden; display: flex; flex-direction: column; }
.cover .photo { height: 62%; background: ${d.color.accent} center/cover no-repeat; position: relative; }
.cover .photo.empty::after { content: ""; position: absolute; inset: 14mm; border: 0.6pt solid rgba(255,255,255,.55); }
.cover .text { flex: 1; padding: 14mm 22mm 12mm; text-align: center; display: flex; flex-direction: column; align-items: center; }
.cover h1 { font-size: ${d.size.coverTitle}pt; line-height: 1.08; margin: 0; font-weight: 700; letter-spacing: -.01em; }
.cover .rule { width: 26mm; height: 0; border-top: 1.2pt solid ${d.color.accent}; margin: 9mm 0 7mm; }
.cover .desc { font-style: italic; color: ${d.color.muted}; font-size: 13pt; max-width: 125mm; margin: 0; }
.cover .count { margin-top: auto; font: ${d.size.label}pt ${d.font.sans}; letter-spacing: .22em; text-transform: uppercase; color: ${d.color.muted}; }

/* ---------- Inhaltsverzeichnis ---------- */
.toc { page: toc; break-after: page; }
.toc h2 { font-size: 26pt; margin: 0 0 8mm; font-weight: 700; }
.toc ol { list-style: none; margin: 0; padding: 0; }
.toc li { display: flex; align-items: baseline; gap: 4mm; padding: 2.2mm 0; border-bottom: 0.4pt solid ${d.color.rule}; break-inside: avoid; }
.toc .no { font: 600 ${d.size.small}pt ${d.font.sans}; color: ${d.color.accent}; width: 8mm; flex: none; }
.toc .t { flex: 1; font-size: 11.5pt; }
.toc .c { font: ${d.size.small}pt ${d.font.sans}; color: ${d.color.muted}; text-align: right; }

/* ---------- Rezept ---------- */
.recipe { break-before: page; }
.recipe .hero { height: ${d.heroHeight}mm; border-radius: ${d.radius}mm; background: ${d.color.card} center/cover no-repeat; margin-bottom: 5mm; break-inside: avoid; }
.recipe .kicker { font: 600 ${d.size.label}pt ${d.font.sans}; letter-spacing: .16em; text-transform: uppercase; color: ${d.color.accent}; margin: 0 0 2mm; }
.recipe h2 { font-size: ${d.size.recipeTitle}pt; line-height: 1.1; margin: 0 0 2.5mm; font-weight: 700; letter-spacing: -.01em; hyphens: manual; }
.recipe .meta { display: flex; flex-wrap: wrap; gap: 2mm 6mm; font: 500 ${d.size.small}pt ${d.font.sans}; color: ${d.color.muted}; margin-bottom: 3mm; }
.recipe .meta b { color: ${d.color.ink}; font-weight: 600; }
.recipe .lead { font-style: italic; color: ${d.color.muted}; font-size: 11pt; margin: 0 0 4mm; }
.recipe .body { display: grid; grid-template-columns: ${d.ingredientsWidth}mm 1fr; gap: 9mm; border-top: 0.6pt solid ${d.color.rule}; padding-top: 6mm; align-items: start; }
.recipe .nutrition + .body { border-top: 0; padding-top: 1mm; }
/* Umbruch-System: Passt ein Rezept nicht auf eine Seite, setzt der Server die Klasse "flow"
   (gemessen, siehe nas-api/src/htmlToPdf.js). Dann steht die Zutatenliste zweispaltig über die
   volle Breite, danach folgt die Zubereitung; umgebrochen wird nur zwischen Zeilen/Schritten. */
.recipe.flow .body { display: block; border-top: 0; padding-top: 1mm; }
.recipe.flow .ingredients { margin-bottom: 7mm; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.recipe.flow .ing-cols { column-count: 2; column-gap: 9mm; }
.recipe.flow .ingredients h4 { break-after: avoid; }
.recipe .ingredients .grp:first-child h4 { margin-top: 0; }
.recipe.flow ol.steps li { break-inside: auto; orphans: 3; widows: 3; }
/* ---------- Layout "doppelseite" ---------- */
.spread { break-before: page; }
.spread .sp-photo { break-after: page; height: calc(${DESIGN.page.height - DESIGN.margin.top - DESIGN.margin.bottom}mm - 1mm); display: flex; flex-direction: column; }
.spread .sp-hero { flex: 1; min-height: ${d.spread.photoHeight}mm; border-radius: ${d.radius}mm; background: ${d.color.card} center/cover no-repeat; margin-bottom: 8mm; }
.spread .lead { font-size: 12pt; margin: 6mm 0 0; }
.spread .nutrition { margin: 0; }
.spread .sp-text .nutrition { margin: 7mm 0 3mm; }
.spread .sp-text { font-size: calc(var(--fs, 1) * ${d.size.body}pt); }
.spread .sp-text h2 { font-size: 24pt; margin: 0 0 2mm; }
.spread .sp-text .meta { font-size: 0.85em; margin-bottom: 4mm; }
.spread .sp-text h3 { font-size: 1.15em; margin: 5mm 0 2.5mm; padding-top: 3mm; border-top: 0.6pt solid ${d.color.rule}; }
.spread .ing-cols { column-width: 52mm; column-gap: 8mm; }
.spread .grp { margin-bottom: 3mm; }
.spread .grp.small { break-inside: avoid; }
.spread .grp h4 { break-after: avoid; }
.spread .grp h4 { font: 600 0.8em ${d.font.sans}; letter-spacing: .12em; text-transform: uppercase; color: ${d.color.accent}; margin: 0 0 1mm; }
.spread .grp ul { list-style: none; margin: 0; padding: 0; }
.spread .grp li { display: flex; gap: 2mm; padding: 0.5mm 0; font-size: 0.92em; line-height: 1.35; break-inside: avoid; }
.spread .grp .a { flex: none; width: 15mm; font: 700 0.85em ${d.font.sans}; padding-top: 0.3mm; }
.spread ol.steps { column-count: ${d.spread.stepColumns}; column-gap: 9mm; list-style: none; margin: 0; padding: 0; counter-reset: s; }
.spread ol.steps li { break-inside: auto; orphans: 3; widows: 3; font-size: 0.95em; line-height: 1.45; }
.recipe h3 { break-after: avoid; }
.recipe h3 { font: 700 ${d.size.sectionTitle}pt ${d.font.serif}; margin: 0 0 3mm; }
.recipe .ingredients { background: ${d.color.card}; border-radius: ${d.radius}mm; padding: 4mm 4.5mm 3mm; }
.recipe .ingredients h4 { font: 600 ${d.size.label}pt ${d.font.sans}; letter-spacing: .12em; text-transform: uppercase; color: ${d.color.accent}; margin: 3.5mm 0 1.5mm; }
.recipe .ingredients .ing-cols > h4:first-child { margin-top: 0; }
.recipe .ingredients ul { list-style: none; margin: 0; padding: 0; }
.recipe .ingredients li { display: flex; gap: 2.5mm; padding: 0.85mm 0; border-bottom: 0.3pt dotted ${d.color.rule}; break-inside: avoid; font-size: ${d.size.body - 0.5}pt; line-height: 1.35; }
.recipe .ingredients li:last-child { border-bottom: 0; }
.recipe .ingredients .a { flex: none; width: 17mm; font-weight: 700; font-family: ${d.font.sans}; font-size: ${d.size.small}pt; padding-top: 0.3mm; }
.recipe ol.steps { list-style: none; margin: 0; padding: 0; counter-reset: s; }
.recipe ol.steps li { counter-increment: s; position: relative; padding-left: 9mm; margin-bottom: 3.5mm; break-inside: avoid; }
.recipe ol.steps li::before { content: counter(s); position: absolute; left: 0; top: 0.4mm; width: 5.6mm; height: 5.6mm; border-radius: 50%; background: ${d.color.accent}; color: #fff; font: 700 ${d.size.small}pt/5.6mm ${d.font.sans}; text-align: center; }
.recipe .nutrition { position: relative; display: grid; grid-template-columns: repeat(5, 1fr); margin: 0 0 4mm; border-top: 0.6pt solid ${d.color.rule}; border-bottom: 0.6pt solid ${d.color.rule}; break-inside: avoid; }
.recipe .nutrition::before { content: "pro Portion"; position: absolute; top: -1.5mm; left: 50%; transform: translateX(-50%); background: ${d.color.paper}; padding: 0 2.5mm; font: ${d.size.label - 1}pt/1 ${d.font.sans}; letter-spacing: .12em; text-transform: uppercase; color: ${d.color.muted}; }
.recipe .nutrition div { text-align: center; padding: 3mm 1mm 2mm; }
.recipe .nutrition div + div { border-left: 0.4pt solid ${d.color.rule}; }
.recipe .nutrition b { display: block; font: 700 12pt ${d.font.serif}; color: ${d.color.ink}; }
.recipe .nutrition span { font: ${d.size.label}pt ${d.font.sans}; letter-spacing: .1em; text-transform: uppercase; color: ${d.color.muted}; }
`;
}

// ------------------------------------------------------------------ HTML

function coverHtml(doc: CookbookDoc): string {
  const src = safeSrc(doc.cover);
  const n = doc.recipes.length;
  return `
<section class="cover">
  <div class="photo${src ? "" : " empty"}"${src ? ` style="background-image:url('${src}')"` : ""}></div>
  <div class="text">
    <h1>${esc(doc.title)}</h1>
    <div class="rule"></div>
    ${doc.description ? `<p class="desc">${esc(doc.description)}</p>` : ""}
    <div class="count">${n} ${n === 1 ? "Rezept" : "Rezepte"}</div>
  </div>
</section>`;
}

function tocHtml(doc: CookbookDoc): string {
  if (doc.recipes.length < 2) return "";
  const rows = doc.recipes
    .map(
      (r, i) => `
    <li><span class="no">${pad2(i + 1)}</span><span class="t">${esc(r.title)}</span>
    <span class="c">${esc([r.categories[0], formatMinutes(r.totalMinutes)].filter(Boolean).join(" · "))}</span></li>`,
    )
    .join("");
  return `<section class="toc"><h2>Inhalt</h2><ol>${rows}</ol></section>`;
}

function metaHtml(r: CookbookRecipe): string {
  const meta: string[] = [];
  const time = formatMinutes(r.totalMinutes);
  if (time) meta.push(`<span><b>${esc(time)}</b> Zeit</span>`);
  if (r.servings)
    meta.push(
      `<span><b>${esc(r.servings)}</b> ${r.servings === 1 ? "Portion" : "Portionen"}</span>`,
    );
  if (r.categories.length > 1) meta.push(`<span>${esc(r.categories.slice(1).join(", "))}</span>`);
  return meta.length ? `<div class="meta">${meta.join("")}</div>` : "";
}

function sectionsHtml(r: CookbookRecipe): string {
  return r.sections
    .filter((s) => s.ingredients.length > 0)
    .map(
      (s) => `
      <div class="grp${s.ingredients.length <= 6 ? " small" : ""}">${s.title ? `<h4>${esc(s.title)}</h4>` : ""}
      <ul>${s.ingredients
        .map((i) => `<li><span class="a">${esc(i.amount)}</span><span>${esc(i.name)}</span></li>`)
        .join("")}</ul></div>`,
    )
    .join("");
}

function nutritionHtml(r: CookbookRecipe): string {
  const n = r.nutrition;
  if (!n) return "";
  return `
  <div class="nutrition">
    <div><b>${nf(n.kcal)}</b><span>kcal</span></div>
    <div><b>${nf(n.protein_g, 1)} g</b><span>Eiweiß</span></div>
    <div><b>${nf(n.carbs_g, 1)} g</b><span>Kohlenhydrate</span></div>
    <div><b>${nf(n.fat_g, 1)} g</b><span>Fett</span></div>
    <div><b>${nf(n.fiber_g, 1)} g</b><span>Ballaststoffe</span></div>
  </div>`;
}

const heroHtml = (src: string | null, cls = "hero") =>
  src ? `<div class="${cls}" style="background-image:url('${src}')"></div>` : "";
const kickerHtml = (r: CookbookRecipe, index: number) =>
  `<p class="kicker">${pad2(index + 1)}${r.categories[0] ? ` · ${esc(r.categories[0])}` : ""}</p>`;
const stepsHtml = (r: CookbookRecipe) =>
  `<ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`;

/** Layout "seite": ein Rezept pro Seite, lange Rezepte fließen (Klasse "flow", vom Server gesetzt). */
function recipeHtml(r: CookbookRecipe, index: number): string {
  const src = safeSrc(r.image);
  const sections = sectionsHtml(r);
  return `
<article class="recipe">
  ${heroHtml(src)}
  ${kickerHtml(r, index)}
  <h2>${esc(r.title)}</h2>
  ${metaHtml(r)}
  ${r.description ? `<p class="lead">${esc(r.description)}</p>` : ""}
  ${nutritionHtml(r)}
  <div class="body">
    <div>
      <div class="ingredients"><h3>Zutaten</h3><div class="ing-cols">${sections || "<p>–</p>"}</div></div>
    </div>
    <div>
      <h3>Zubereitung</h3>
      ${stepsHtml(r)}
    </div>
  </div>
</article>`;
}

/**
 * Layout "doppelseite": Foto-Seite (Foto, Nährwerte, Beschreibung) + Text-Seite (Titel, Zutaten in
 * Spalten, Schritte in Spalten). Ohne Foto gibt es nur die Text-Seite. Die Schriftgröße der
 * Text-Seite setzt der Server per Messung (Variable --fs, siehe nas-api/src/htmlToPdf.js).
 */
function recipeSpreadHtml(r: CookbookRecipe, index: number): string {
  const src = safeSrc(r.image);
  const lead = r.description ? `<p class="lead">${esc(r.description)}</p>` : "";
  const photoPage = src
    ? `<section class="sp-photo">${heroHtml(src, "sp-hero")}${nutritionHtml(r)}${lead}</section>`
    : "";
  const headExtras = src ? "" : `${lead}${nutritionHtml(r)}`;
  return `
<article class="recipe spread">
  ${photoPage}
  <section class="sp-text">
    ${kickerHtml(r, index)}
    <h2>${esc(r.title)}</h2>
    ${metaHtml(r)}
    ${headExtras}
    <h3>Zutaten</h3>
    <div class="ing-cols">${sectionsHtml(r) || "<p>–</p>"}</div>
    <h3>Zubereitung</h3>
    ${stepsHtml(r)}
  </section>
</article>`;
}

/**
 * Komplettes HTML-Dokument (ohne externe Ressourcen). Der Platzhalter `/*FONTS*\/` wird vom Server
 * durch die eingebetteten Schriften ersetzt; Bilder sind storage://-Verweise, die der Server
 * verkleinert einbettet.
 */
export function renderCookbookHtml(
  doc: CookbookDoc,
  opts: { fontCss?: string; layout?: "seite" | "doppelseite" } = {},
): string {
  const layout = opts.layout ?? DESIGN.layout;
  const contentWidthMm = DESIGN.page.width - DESIGN.margin.left - DESIGN.margin.right;
  const contentHeightMm = DESIGN.page.height - DESIGN.margin.top - DESIGN.margin.bottom;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${esc(doc.title)}</title>
<style>${opts.fontCss ?? "/*FONTS*/"}${css(doc.title)}</style>
</head>
<body data-layout="${layout}" data-content-width-mm="${contentWidthMm}" data-content-height-mm="${contentHeightMm}" data-min-scale="${DESIGN.spread.minScale}">
${coverHtml(doc)}
${tocHtml(doc)}
${doc.recipes.map(layout === "doppelseite" ? recipeSpreadHtml : recipeHtml).join("\n")}
</body>
</html>`;
}
