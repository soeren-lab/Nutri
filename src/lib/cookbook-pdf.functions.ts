import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nutritionPerServing } from "@/lib/componentNutrition";


const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 50;
const PAPER_BG = { r: 0.98, g: 0.96, b: 0.91 }; // cremefarben
const INK = { r: 0.15, g: 0.12, b: 0.08 };
const MUTED = { r: 0.42, g: 0.36, b: 0.28 };
const RULE = { r: 0.78, g: 0.72, b: 0.6 };


async function fetchImageBytes(
  supabase: any,
  bucket: string,
  path: string | null | undefined,
): Promise<{ bytes: Uint8Array; kind: "jpg" | "png" } | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return null;
    const buf = new Uint8Array(await data.arrayBuffer());
    if (buf.length < 4) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8) return { bytes: buf, kind: "jpg" };
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
      return { bytes: buf, kind: "png" };
    return null; // unsupported by pdf-lib (webp/gif/avif)
  } catch {
    return null;
  }
}

// Sanitize a string to WinAnsi (StandardFonts) — replace unsupported chars.
function sanitize(text: string): string {
  return text
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    // Drop any remaining chars outside WinAnsi (rough BMP filter)
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u2022]/g, "");
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function slugify(s: string): string {
  return sanitize(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "kochbuch";
}

export const generateCookbookPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cookbookId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { PDFDocument, StandardFonts, rgb, PageSizes: _s } = await import("pdf-lib");
    void _s;

    const { data: cookbook, error: cbErr } = await supabase
      .from("cookbooks")
      .select("*")
      .eq("id", data.cookbookId)
      .maybeSingle();
    if (cbErr) throw new Error(cbErr.message);
    if (!cookbook) throw new Error("Kochbuch nicht gefunden");

    const RECIPE_SELECT =
      "*, ingredients(*, master:ingredients_master(*)), steps(*), components:recipe_components!recipe_components_recipe_id_fkey(*)";

    const { data: cRecipes, error: crErr } = await supabase
      .from("cookbook_recipes")
      .select(`sort_order, recipe:recipes(${RECIPE_SELECT})`)
      .eq("cookbook_id", data.cookbookId)
      .order("sort_order", { ascending: true });
    if (crErr) throw new Error(crErr.message);

    /** Zutaten den Komponenten zuordnen (für die Summen-Berechnung). */
    const withComponents = (r: any, linkedById: Map<string, any>) => ({
      ...r,
      ingredients: (r.ingredients ?? []).sort(
        (a: any, b: any) => a.sort_order - b.sort_order,
      ),
      steps: (r.steps ?? []).sort((a: any, b: any) => a.step_number - b.step_number),
      components: (r.components ?? [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((c: any) => ({
          ...c,
          ingredients: (r.ingredients ?? []).filter(
            (i: any) => i.component_id === c.id,
          ),
          linked: c.linked_recipe_id ? (linkedById.get(c.linked_recipe_id) ?? null) : null,
        })),
    });

    const rawRecipes = (cRecipes ?? []).map((r: any) => r.recipe).filter(Boolean);

    // Verlinkte Komponenten-Rezepte nachladen (eine Ebene tief).
    const linkedIds = [
      ...new Set(
        rawRecipes.flatMap((r: any) =>
          (r.components ?? [])
            .map((c: any) => c.linked_recipe_id)
            .filter((id: string | null): id is string => !!id),
        ),
      ),
    ];
    const linkedById = new Map<string, any>();
    if (linkedIds.length > 0) {
      const { data: linked } = await supabase
        .from("recipes")
        .select(RECIPE_SELECT)
        .in("id", linkedIds);
      for (const l of linked ?? []) {
        linkedById.set((l as any).id, withComponents(l, new Map()));
      }
    }

    const recipes = rawRecipes.map((r: any) => withComponents(r, linkedById));


    const pdf = await PDFDocument.create();
    pdf.setTitle(sanitize(cookbook.title));
    if (cookbook.description) pdf.setSubject(sanitize(cookbook.description));

    const serif = await pdf.embedFont(StandardFonts.TimesRoman);
    const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
    const sans = await pdf.embedFont(StandardFonts.Helvetica);

    const paper = rgb(PAPER_BG.r, PAPER_BG.g, PAPER_BG.b);
    const ink = rgb(INK.r, INK.g, INK.b);
    const muted = rgb(MUTED.r, MUTED.g, MUTED.b);
    const rule = rgb(RULE.r, RULE.g, RULE.b);

    // ---------- Cover ----------
    const cover = pdf.addPage([PAGE_W, PAGE_H]);
    cover.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: paper });

    const coverImg = await fetchImageBytes(supabase, "cookbook-covers", cookbook.cover_image_url);
    if (coverImg) {
      try {
        const embedded =
          coverImg.kind === "jpg" ? await pdf.embedJpg(coverImg.bytes) : await pdf.embedPng(coverImg.bytes);
        const maxW = PAGE_W - MARGIN * 2;
        const maxH = PAGE_H * 0.5;
        const scale = Math.min(maxW / embedded.width, maxH / embedded.height);
        const w = embedded.width * scale;
        const h = embedded.height * scale;
        cover.drawImage(embedded, { x: (PAGE_W - w) / 2, y: PAGE_H - MARGIN - h, width: w, height: h });
      } catch {
        // skip
      }
    }

    const titleSize = 42;
    const title = sanitize(cookbook.title);
    const titleLines = wrapText(title, serifBold, titleSize, PAGE_W - MARGIN * 2);
    let cy = PAGE_H * 0.36;
    for (const line of titleLines) {
      const w = serifBold.widthOfTextAtSize(line, titleSize);
      cover.drawText(line, { x: (PAGE_W - w) / 2, y: cy, size: titleSize, font: serifBold, color: ink });
      cy -= titleSize * 1.1;
    }

    // Decorative rule
    cy -= 20;
    cover.drawLine({
      start: { x: PAGE_W / 2 - 60, y: cy },
      end: { x: PAGE_W / 2 + 60, y: cy },
      thickness: 0.8,
      color: rule,
    });
    cy -= 30;

    if (cookbook.description) {
      const descLines = wrapText(cookbook.description, serifItalic, 13, PAGE_W - MARGIN * 3);
      for (const line of descLines.slice(0, 6)) {
        const w = serifItalic.widthOfTextAtSize(line, 13);
        cover.drawText(line, { x: (PAGE_W - w) / 2, y: cy, size: 13, font: serifItalic, color: muted });
        cy -= 18;
      }
    }

    const countText = `${recipes.length} Rezept${recipes.length === 1 ? "" : "e"}`;
    const cw = serif.widthOfTextAtSize(countText, 11);
    cover.drawText(countText, { x: (PAGE_W - cw) / 2, y: MARGIN + 10, size: 11, font: serif, color: muted });

    // ---------- Recipes ----------
    const cookbookTitleShort = sanitize(cookbook.title);
    let pageNumber = 1; // cover is unnumbered

    for (const recipe of recipes) {
      pageNumber += 1;
      const page = pdf.addPage([PAGE_W, PAGE_H]);
      page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: paper });

      // Header
      const headerText = cookbookTitleShort;
      page.drawText(headerText, {
        x: MARGIN,
        y: PAGE_H - MARGIN + 10,
        size: 9,
        font: serifItalic,
        color: muted,
      });
      page.drawLine({
        start: { x: MARGIN, y: PAGE_H - MARGIN },
        end: { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN },
        thickness: 0.4,
        color: rule,
      });

      let y = PAGE_H - MARGIN - 20;

      // Load & embed recipe image; decide layout by orientation
      const recipeImg = await fetchImageBytes(supabase, "recipe-images", recipe.image_url);
      let embeddedImg: any = null;
      let isPortrait = false;
      if (recipeImg) {
        try {
          embeddedImg =
            recipeImg.kind === "jpg"
              ? await pdf.embedJpg(recipeImg.bytes)
              : await pdf.embedPng(recipeImg.bytes);
          isPortrait = embeddedImg.height > embeddedImg.width;
        } catch {
          embeddedImg = null;
        }
      }

      // Landscape/square: draw image full-width at top (object-fit: contain)
      if (embeddedImg && !isPortrait) {
        const maxW = PAGE_W - MARGIN * 2;
        const maxH = 240;
        const scale = Math.min(maxW / embeddedImg.width, maxH / embeddedImg.height);
        const w = embeddedImg.width * scale;
        const h = embeddedImg.height * scale;
        page.drawImage(embeddedImg, { x: (PAGE_W - w) / 2, y: y - h, width: w, height: h });
        y -= h + 20;
      }

      // Title
      const rTitle = sanitize(recipe.title);
      const rTitleLines = wrapText(rTitle, serifBold, 24, PAGE_W - MARGIN * 2);
      for (const line of rTitleLines) {
        page.drawText(line, { x: MARGIN, y, size: 24, font: serifBold, color: ink });
        y -= 28;
      }
      y -= 4;

      // Meta line: category · time · portions
      const meta: string[] = [];
      const cats = (recipe.categories ?? []).filter(Boolean);
      if (cats.length) meta.push(cats.join(", "));
      const totalMin =
        (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);
      if (totalMin > 0) meta.push(`${totalMin} Min`);
      if (recipe.servings) meta.push(`${recipe.servings} Portion${recipe.servings === 1 ? "" : "en"}`);
      if (meta.length) {
        page.drawText(sanitize(meta.join("  ·  ")), {
          x: MARGIN,
          y,
          size: 10,
          font: sans,
          color: muted,
        });
        y -= 18;
      }

      if (recipe.description) {
        const dLines = wrapText(recipe.description, serifItalic, 11, PAGE_W - MARGIN * 2);
        for (const line of dLines.slice(0, 4)) {
          page.drawText(line, { x: MARGIN, y, size: 11, font: serifItalic, color: muted });
          y -= 15;
        }
        y -= 4;
      }

      // Divider
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_W - MARGIN, y },
        thickness: 0.4,
        color: rule,
      });
      y -= 18;

      // Content layout: portrait image goes into left column, ingredients+steps stacked on right;
      // otherwise ingredients-left / steps-right two-column.
      const colGap = 24;
      if (embeddedImg && isPortrait) {
        // Portrait: image left ~35%, right column = Zutaten + Zubereitung stacked
        const imgColW = 190;
        const scale = imgColW / embeddedImg.width;
        const imgH = Math.min(embeddedImg.height * scale, PAGE_H - MARGIN - 60 - (PAGE_H - MARGIN - y));
        const finalScale = Math.min(scale, imgH / embeddedImg.height);
        const iw = embeddedImg.width * finalScale;
        const ih = embeddedImg.height * finalScale;
        page.drawImage(embeddedImg, { x: MARGIN, y: y - ih, width: iw, height: ih });

        const rightX = MARGIN + imgColW + colGap;
        const rightW = PAGE_W - MARGIN - rightX;
        let yR = y;

        // Zutaten
        page.drawText("Zutaten", { x: rightX, y: yR, size: 13, font: serifBold, color: ink });
        yR -= 18;
        const amtW = 55;
        for (const ing of recipe.ingredients) {
          if (yR < MARGIN + 40) break;
          const amount =
            ing.amount != null && ing.amount !== 0
              ? `${Number.isInteger(ing.amount) ? ing.amount : ing.amount.toFixed(1)} ${ing.unit ?? ""}`.trim()
              : "";
          const label = sanitize(ing.master?.name ?? ing.name);
          if (amount) {
            page.drawText(sanitize(amount), {
              x: rightX,
              y: yR,
              size: 10,
              font: serifBold,
              color: ink,
            });
          }
          const nameLines = wrapText(label, serif, 10, rightW - amtW);
          for (let i = 0; i < nameLines.length; i++) {
            page.drawText(nameLines[i], {
              x: rightX + amtW,
              y: yR,
              size: 10,
              font: serif,
              color: ink,
            });
            if (i < nameLines.length - 1) yR -= 13;
          }
          yR -= 15;
        }
        yR -= 8;

        // Zubereitung — either continues in right column or spans full width below image
        let stepsX = rightX;
        let stepsW = rightW;
        const imgBottom = y - ih;
        if (yR < imgBottom + 20) {
          yR = imgBottom - 20;
          stepsX = MARGIN;
          stepsW = PAGE_W - MARGIN * 2;
        }
        page.drawText("Zubereitung", { x: stepsX, y: yR, size: 13, font: serifBold, color: ink });
        yR -= 18;
        let sIdx = 1;
        for (const step of recipe.steps) {
          if (yR < MARGIN + 40) {
            page.drawText("...", { x: stepsX, y: yR, size: 10, font: serif, color: muted });
            break;
          }
          // If we're still in the right column and hit the image bottom, jump below full width
          if (stepsX === rightX && yR < imgBottom + 20) {
            stepsX = MARGIN;
            stepsW = PAGE_W - MARGIN * 2;
            yR = imgBottom - 20;
          }
          page.drawText(`${sIdx}.`, { x: stepsX, y: yR, size: 11, font: serifBold, color: ink });
          const lines = wrapText(step.instruction ?? "", serif, 11, stepsW - 20);
          for (let i = 0; i < lines.length; i++) {
            if (yR < MARGIN + 40) break;
            page.drawText(lines[i], {
              x: stepsX + 20,
              y: yR,
              size: 11,
              font: serif,
              color: ink,
            });
            yR -= 14;
          }
          yR -= 6;
          sIdx += 1;
        }
      } else {
        // Landscape/no-image: ingredients-left / steps-right
        const leftW = 200;
        const rightW = PAGE_W - MARGIN * 2 - leftW - colGap;
        const startY = y;
        let yL = startY;
        let yR = startY;

        page.drawText("Zutaten", { x: MARGIN, y: yL, size: 13, font: serifBold, color: ink });
        yL -= 18;
        const amtW = 55;
        for (const ing of recipe.ingredients) {
          if (yL < MARGIN + 40) break;
          const amount =
            ing.amount != null && ing.amount !== 0
              ? `${Number.isInteger(ing.amount) ? ing.amount : ing.amount.toFixed(1)} ${ing.unit ?? ""}`.trim()
              : "";
          const label = sanitize(ing.master?.name ?? ing.name);
          if (amount) {
            page.drawText(sanitize(amount), {
              x: MARGIN,
              y: yL,
              size: 10,
              font: serifBold,
              color: ink,
            });
          }
          const nameLines = wrapText(label, serif, 10, leftW - amtW);
          for (let i = 0; i < nameLines.length; i++) {
            page.drawText(nameLines[i], {
              x: MARGIN + amtW,
              y: yL,
              size: 10,
              font: serif,
              color: ink,
            });
            if (i < nameLines.length - 1) yL -= 13;
          }
          yL -= 15;
        }

        const stepsX = MARGIN + leftW + colGap;
        page.drawText("Zubereitung", { x: stepsX, y: yR, size: 13, font: serifBold, color: ink });
        yR -= 18;
        let stepIdx = 1;
        for (const step of recipe.steps) {
          if (yR < MARGIN + 80) {
            page.drawText("...", { x: stepsX, y: yR, size: 10, font: serif, color: muted });
            break;
          }
          page.drawText(`${stepIdx}.`, { x: stepsX, y: yR, size: 11, font: serifBold, color: ink });
          const lines = wrapText(step.instruction ?? "", serif, 11, rightW - 20);
          for (let i = 0; i < lines.length; i++) {
            if (yR < MARGIN + 60) break;
            page.drawText(lines[i], {
              x: stepsX + 20,
              y: yR,
              size: 11,
              font: serif,
              color: ink,
            });
            yR -= 14;
          }
          yR -= 6;
          stepIdx += 1;
        }
      }

      // Nährwerte pro Portion – identische Logik wie Detailseite/Karte
      // (bei Komponenten-Rezepten Summe aller Komponenten).
      const per = nutritionPerServing(recipe as any);
      const nutrition = [
        `${Math.round(per.calories ?? 0)} kcal`,
        `${(per.protein_g ?? 0).toFixed(1)} g Eiweiß`,
        `${(per.carbs_g ?? 0).toFixed(1)} g Kohlenhydrate`,
        `${(per.fat_g ?? 0).toFixed(1)} g Fett`,
        `${(per.fiber_g ?? 0).toFixed(1)} g Ballaststoffe`,
      ].join("  ·  ");


      const nutLabel = "pro Portion:  " + nutrition;
      page.drawText(sanitize(nutLabel), {
        x: MARGIN,
        y: MARGIN + 12,
        size: 9,
        font: sans,
        color: muted,
      });

      // Page number
      const pn = String(pageNumber);
      const pnW = serif.widthOfTextAtSize(pn, 10);
      page.drawText(pn, {
        x: (PAGE_W - pnW) / 2,
        y: MARGIN - 12,
        size: 10,
        font: serif,
        color: muted,
      });
    }

    const bytes = await pdf.save();
    // Base64 encode without spreading (avoid stack overflow on large PDFs)
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);

    return {
      filename: `${slugify(cookbook.title)}.pdf`,
      base64,
    };
  });
