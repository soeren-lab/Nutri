/**
 * Foto-Scan (Max-Plan): wertet ein Essensfoto per Claude-Vision aus und bucht die Kosten vom Guthaben ab.
 * Portierung von src/lib/photoScan.functions.ts (lief früher auf dem Cloudflare-Worker).
 */
import { query, esc } from "./db.js";
import { ApiError } from "./query.js";
import { callRpc } from "./rpc.js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Schlüssel aus der Umgebung (.env) oder, falls dort leer, aus der Datei src/anthropic-key.txt
 * (eine Zeile, nur der Schlüssel). Praktisch, wenn die NAS die .env nicht an den Container weiterreicht.
 */
export function getAnthropicKey() {
  const fromEnv = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (fromEnv) return fromEnv;
  try {
    const file = join(dirname(fileURLToPath(import.meta.url)), "anthropic-key.txt");
    return readFileSync(file, "utf-8").trim();
  } catch {
    return "";
  }
}

const DAILY_LIMIT = 40;
const DEFAULT_MODEL = "claude-sonnet-5-5";
// Modelle, die der Nutzer in den Einstellungen wählen darf (alles andere wird ignoriert).
const ALLOWED_MODELS = new Set(["claude-haiku-5-5", "claude-sonnet-5-5"]);
const MAX_IMAGE = 3_000_000;

// Muss mit src/lib/credits.ts übereinstimmen.
const CREDIT_MARKUP = 1.2;
const PRICES = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-fable-5-1": { input: 10, output: 50 },
};
const FALLBACK_PRICE = { input: 10, output: 50 };

export function usageCostUsd(model, usage) {
  const p = PRICES[model] ?? FALLBACK_PRICE;
  const raw = (usage.input_tokens * p.input + usage.output_tokens * p.output) / 1_000_000;
  return Math.round(raw * CREDIT_MARKUP * 1_000_000) / 1_000_000;
}

const PLAN_RANK = { free: 0, pro: 1, max: 2 };

const SYSTEM_PROMPT = `Du bist der Ernährungs-Assistent einer deutschsprachigen Tracking-App. Du zerlegst eine Mahlzeit auf einem Foto in einzelne Lebensmittel und schätzt die verzehrte Menge. Du berechnest KEINE Gesamt-Nährwerte, das macht die App selbst.

Regeln:
- Jede Position hat name (kurz, deutsch), amount und unit. Verwende "g" für feste Lebensmittel, "ml" für Flüssigkeiten und "Stück" nur, wenn die passende Bibliotheks-Zutat die Einheit Stück hat.
- Wähle für master_id bevorzugt einen Eintrag aus der Bibliotheksliste des Nutzers (nur IDs aus der Liste, nie erfinden). Wenn nichts passt, setze master_id auf null und gib per100 mit groben Richtwerten pro 100 g bzw. 100 ml an.
- Beachte den Zustand: Reis, Nudeln und Hülsenfrüchte auf dem Teller sind gekocht. Gibt es nur einen Rohwert-Eintrag, rechne die Menge auf das Rohgewicht um.
- Ist ein Teller bzw. eine Schüssel mit Maßen angegeben, ist genau dieses Geschirr auf dem Foto. Nutze die Maße als absoluten Maßstab: schätze, welchen Anteil der Fläche bzw. des Volumens das Essen belegt, wie hoch es liegt und bei Schüsseln mit Fassungsvermögen den Füllgrad. Ohne Maße schätze anhand von Tellergröße, Besteck und Proportionen.
- Schätze realistische Mengen anhand von Tellergröße, Besteck und Proportionen. Gib low und high als plausible Spanne derselben Menge an (typisch plus/minus 15 bis 25 Prozent) und confidence (high, medium, low).
- Das Referenzfoto (falls vorhanden) zeigt Zutaten oder Packungen und die Notiz nennt Verstecktes (Öl, Butter, Käse, Sauce, Zucker). Nutze beides und lege Öle und Fette als eigene Position an, wenn sie verwendet wurden.
- Ein Gericht ist nie eine einzelne Position. Zusammengesetzte Speisen (Auflauf, Gratin, Lasagne, Eintopf, Suppe, Pizza, Burger, Pfanne, Salat mit Beilagen usw.) zerlegst du in ihre Grundzutaten (z. B. Nudeln, Schinken, Käse, Sauce, Gemüse) mit geschätzten Anteilen. Den Namen des Gerichts setzt du nur in summary_name. Bei Teilen, die du unter anderen Zutaten nicht sehen kannst, schätzt du typische Anteile und setzt confidence auf "low".
- Bibliotheks-Einträge, die selbst Fertigprodukte oder Gerichte sind (z. B. Fertigsoßen, Backmischungen, Tiefkühlgerichte), gelten nur für ihren eigenen Anteil, nie für das ganze Gericht. Eine Fertigsoße ist nur die Soße (kleine Menge), nicht der gesamte Auflauf. Nutze so einen Eintrag nur, wenn die Notiz, das Referenzfoto oder eine sichtbare Packung ihn nahelegt. Sonst gehe von selbst zubereiteten Grundzutaten aus.
- Stelle höchstens eine Rückfrage (question), und nur, wenn eine Position mehr als etwa 60 kcal Unsicherheit hat und das Foto sie nicht klärt. Ein typischer Fall ist eine Sauce, die Fertigprodukt (aus der Bibliothek) oder selbst gemacht sein kann: frage dann kurz danach, es sei denn, die Notiz klärt es schon.
- Setze kind pro Position auf "gericht", wenn die Position ein ganzes zusammengesetztes Gericht ist (das sollst du vermeiden), sonst auf "zutat".
- Bei einer Korrektur bekommst du die bisherigen Positionen und die Änderung des Nutzers. Setze nur diese Änderung um, lasse alles andere unverändert und gib die vollständige neue Liste zurück.
- Ist auf dem Foto kein Essen zu erkennen, gib eine leere items-Liste zurück.
Antworte ausschließlich über das Werkzeug report_meal.`;

const TOOL = {
  name: "report_meal",
  description: "Meldet die erkannten Positionen der Mahlzeit.",
  input_schema: {
    type: "object",
    properties: {
      summary_name: { type: "string", description: "Kurzer Name der Mahlzeit" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            master_id: { type: ["string", "null"] },
            amount: { type: "number" },
            unit: { type: "string" },
            low: { type: "number" },
            high: { type: "number" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            kind: { type: "string", enum: ["zutat", "gericht"] },
            per100: {
              type: ["object", "null"],
              properties: {
                calories: { type: "number" },
                protein_g: { type: "number" },
                carbs_g: { type: "number" },
                fat_g: { type: "number" },
                fiber_g: { type: ["number", "null"] },
                sugar_g: { type: ["number", "null"] },
              },
              required: ["calories", "protein_g", "carbs_g", "fat_g"],
            },
          },
          required: ["name", "master_id", "amount", "unit", "low", "high", "confidence"],
        },
      },
      question: { type: ["string", "null"] },
    },
    required: ["summary_name", "items"],
  },
};

// ---------------------------------------------------------------- Validierung

const isStr = (v, min, max) => typeof v === "string" && v.length >= min && v.length <= max;
const isNum = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const bad = (msg) => new ApiError(msg, "400");

function num(v, min, max) {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

function cleanPer100(p) {
  if (!p || typeof p !== "object") return null;
  if (!num(p.calories, 0, 950) || !num(p.protein_g, 0, 100) || !num(p.carbs_g, 0, 100) || !num(p.fat_g, 0, 100)) return null;
  const opt = (x) => (num(x, 0, 100) ? x : null);
  return { calories: p.calories, protein_g: p.protein_g, carbs_g: p.carbs_g, fat_g: p.fat_g, fiber_g: opt(p.fiber_g), sugar_g: opt(p.sugar_g) };
}

/** Gültige Position oder null (gleiche Grenzen wie scanItemSchema in photoNutrition.ts). */
function cleanItem(e) {
  if (!e || typeof e !== "object") return null;
  if (!isStr(e.name, 1, 80) || !isStr(e.unit, 1, 12)) return null;
  if (!(e.master_id === null || typeof e.master_id === "string")) return null;
  if (!num(e.amount, 0.0001, 5000) || !num(e.low, 0.0001, 5000) || !num(e.high, 0.0001, 5000)) return null;
  if (!["high", "medium", "low"].includes(e.confidence)) return null;
  return { name: e.name, master_id: e.master_id, amount: e.amount, unit: e.unit, low: e.low, high: e.high, confidence: e.confidence, per100: cleanPer100(e.per100) };
}

function validateInput(b) {
  const out = {};
  for (const key of ["image", "refImage"]) {
    if (b[key] != null) {
      if (!isStr(b[key], 100, MAX_IMAGE)) throw bad("Das Foto ist ungültig oder zu groß.");
      out[key] = b[key];
    }
  }
  if (typeof b.model === "string" && ALLOWED_MODELS.has(b.model)) out.model = b.model;
  if (b.note != null) { if (!isStr(b.note, 0, 1000)) throw bad("Notiz zu lang"); out.note = b.note; }
  if (b.correction != null) { if (!isStr(b.correction, 0, 1000)) throw bad("Korrektur zu lang"); out.correction = b.correction; }
  if (b.previous != null) {
    if (!Array.isArray(b.previous) || b.previous.length > 30) throw bad("Bisherige Positionen ungültig");
    out.previous = b.previous.map(cleanItem).filter(Boolean);
  }
  const cands = Array.isArray(b.candidates) ? b.candidates : [];
  if (cands.length > 400) throw bad("Zu viele Bibliotheks-Zutaten");
  out.candidates = cands
    .filter((c) => c && isStr(c.id, 1, 64) && isStr(c.name, 1, 80) && isStr(c.unit, 1, 12))
    .map((c) => ({ id: c.id, name: c.name, unit: c.unit }));
  if (b.plate != null) {
    const p = b.plate;
    if (!isStr(p.name, 1, 80) || !["round", "oval", "bowl"].includes(p.shape) || !num(p.width_cm, 0.1, 100) || !num(p.depth_cm, 0.1, 50)) {
      throw bad("Geschirr ungültig");
    }
    out.plate = {
      name: p.name, shape: p.shape, width_cm: p.width_cm, depth_cm: p.depth_cm,
      length_cm: num(p.length_cm, 0.1, 100) ? p.length_cm : null,
      capacity_ml: num(p.capacity_ml, 0.1, 10000) ? p.capacity_ml : null,
    };
  }
  if (!out.image && !(out.previous?.length && out.correction?.trim())) throw bad("Foto oder Korrektur fehlt");
  return out;
}

const n1 = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
function describePlate(p) {
  const parts = [];
  if (p.shape === "oval") {
    parts.push(p.length_cm ? `Teller (oval/eckig), ${n1(p.width_cm)} × ${n1(p.length_cm)} cm` : `Teller (oval/eckig), Breite ${n1(p.width_cm)} cm`);
  } else if (p.shape === "bowl") {
    parts.push(`Schüssel, Durchmesser ${n1(p.width_cm)} cm`);
  } else {
    parts.push(`Teller (rund), Durchmesser ${n1(p.width_cm)} cm`);
  }
  parts.push(`Tiefe ${n1(p.depth_cm)} cm`);
  if (p.capacity_ml) parts.push(`Fassungsvermögen ${Math.round(p.capacity_ml)} ml`);
  return parts.join(", ");
}

// ---------------------------------------------------------------- Modellaufruf

const DISH_WORDS = /auflauf|gratin|lasagne|eintopf|suppe|pizza|burger|pfanne|curry|bowl|salat|g(e)?richt|pasta|nudeln mit/i;

function toolInput(json) {
  const block = (json.content || []).find((b) => b.type === "tool_use");
  return block?.input ?? {};
}

/** True, wenn nur eine einzige Position kam, die ein ganzes Gericht ist. */
function needsDecomposition(raw, candidates) {
  const items = Array.isArray(raw.items) ? raw.items : [];
  if (items.length !== 1) return false;
  const it = items[0];
  if (it.kind === "gericht") return true;
  // Name klingt nach Gericht, ist mengenmäßig eine ganze Mahlzeit und keine Zutat der Bibliothek,
  // die genau so heißt (Fertigsoße "Nudelschinken Gratin" ist als einzelne kleine Position legitim).
  const inLibrary = candidates.some((c) => c.id === it.master_id);
  return DISH_WORDS.test(String(it.name)) && Number(it.amount) >= 250 && !inLibrary;
}

async function askModel(apiKey, model, content) {
  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 2000, system: SYSTEM_PROMPT, tools: [TOOL], messages: [{ role: "user", content }] }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (e) {
    console.error("[photo-scan] Anthropic nicht erreichbar", e?.message);
    throw new ApiError("Die KI ist gerade nicht erreichbar. Prüfe die Internetverbindung der NAS.", "502");
  }
  if (!response.ok) {
    const text = await response.text();
    let detail = "";
    try { detail = JSON.parse(text)?.error?.message ?? ""; } catch { /* kein JSON */ }
    console.error(`[photo-scan] Anthropic-Fehler ${response.status} rid=${response.headers.get("request-id")} body=${JSON.stringify(text.slice(0, 600))}`);
    throw new ApiError(`Die KI-Auswertung ist fehlgeschlagen (${response.status})${detail ? `: ${detail}` : ""}`, "502");
  }
  return response.json();
}

// ---------------------------------------------------------------- Hauptfunktion

export async function analyzeMealPhoto(uid, body) {
  const data = validateInput(body || {});

  const [planRow] = await query(`SELECT plan FROM user_plans WHERE user_id = ${esc(uid)}`);
  const plan = planRow?.plan === "max" || planRow?.plan === "pro" ? planRow.plan : "free";
  if (PLAN_RANK[plan] < PLAN_RANK.max) throw new ApiError("Der Foto-Scan ist nur im Max-Plan verfügbar.", "403");

  const [credit] = await query(`SELECT balance_usd FROM user_credits WHERE user_id = ${esc(uid)}`);
  if (Number(credit?.balance_usd ?? 0) <= 0) throw new ApiError("Guthaben muss aufgeladen werden.", "402");

  const apiKey = getAnthropicKey();
  if (!apiKey) throw new ApiError("Foto-Scan ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt).", "503");

  const isNewScan = !!data.image;
  if (isNewScan) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString().replace("T", " ").replace("Z", "");
    const [{ c }] = await query(`SELECT COUNT(*) AS c FROM photo_scan_log WHERE user_id = ${esc(uid)} AND created_at >= ${esc(since)}`);
    if (Number(c) >= DAILY_LIMIT) {
      throw new ApiError(`Tageslimit erreicht (${DAILY_LIMIT} Foto-Scans in 24 Stunden). Bitte später erneut versuchen.`, "429");
    }
  }

  const content = [];
  if (data.image) {
    content.push({ type: "text", text: "Foto 1: das Essen auf dem Teller." });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: data.image } });
  }
  if (data.refImage) {
    content.push({ type: "text", text: "Foto 2: Referenz (Zutaten, Packungen, Öl o. Ä.)." });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: data.refImage } });
  }
  const library = data.candidates.map((c) => `${c.id} | ${c.name} | ${c.unit}`).join("\n");
  const parts = [`Bibliothek des Nutzers (id | Name | Einheit):\n${library || "(leer)"}`];
  if (data.plate) parts.push(`Geschirr auf dem Foto: ${data.plate.name} (${describePlate(data.plate)}).`);
  if (data.note?.trim()) parts.push(`Notiz des Nutzers: ${data.note.trim()}`);
  if (data.previous?.length) parts.push(`Bisherige Positionen (JSON): ${JSON.stringify(data.previous)}`);
  if (data.correction?.trim()) parts.push(`Korrektur des Nutzers: ${data.correction.trim()}`);
  content.push({ type: "text", text: parts.join("\n\n") });

  const model = data.model || process.env.PHOTO_SCAN_MODEL || DEFAULT_MODEL;
  let json = await askModel(apiKey, model, content);
  const usage = { input_tokens: json.usage?.input_tokens ?? 0, output_tokens: json.usage?.output_tokens ?? 0 };

  // Besteht das Ergebnis nur aus einem ganzen Gericht, einmal mit Zerlege-Hinweis wiederholen.
  if (needsDecomposition(toolInput(json), data.candidates)) {
    try {
      const retry = await askModel(apiKey, model, [
        ...content,
        { type: "text", text: "Hinweis: Dein erstes Ergebnis war ein ganzes Gericht als einzelne Position. Zerlege das Essen auf dem Foto in seine Grundzutaten (jeweils eigene Position, plausible Anteile). Der Gerichtsname gehört nur in summary_name." },
      ]);
      usage.input_tokens += retry.usage?.input_tokens ?? 0;
      usage.output_tokens += retry.usage?.output_tokens ?? 0;
      if (!needsDecomposition(toolInput(retry), data.candidates)) json = retry;
    } catch (e) {
      console.error("[photo-scan] Zweiter Versuch fehlgeschlagen", e?.message);
    }
  }
  // Die Anfrage(n) haben Geld gekostet, egal ob Essen erkannt wurde: jetzt abbuchen.
  const costUsd = usageCostUsd(model, usage);
  let balanceUsd = null;
  try {
    balanceUsd = Number(await callRpc("charge_credit_usage", uid, {
      _amount_usd: costUsd, _model: model, _input_tokens: usage.input_tokens, _output_tokens: usage.output_tokens,
    }));
  } catch (e) {
    console.error("[photo-scan] Abbuchung fehlgeschlagen", e?.message);
  }

  const raw = toolInput(json);
  const ids = new Set(data.candidates.map((c) => c.id));
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map(cleanItem)
    .filter(Boolean)
    .map((it) => ({
      ...it,
      master_id: it.master_id && ids.has(it.master_id) ? it.master_id : null,
      low: Math.min(it.low, it.amount),
      high: Math.max(it.high, it.amount),
    }));
  if (!items.length) throw new ApiError("Auf dem Foto wurde kein Essen erkannt. Bitte ein anderes Foto versuchen.", "422");

  if (isNewScan) {
    await query(`INSERT INTO photo_scan_log (id, user_id, created_at) VALUES (${esc(randomUUID())}, ${esc(uid)}, ${esc(new Date().toISOString().replace("T", " ").replace("Z", ""))})`);
  }

  return {
    summary_name: typeof raw.summary_name === "string" && raw.summary_name.trim() ? raw.summary_name.trim().slice(0, 80) : "Foto-Mahlzeit",
    items,
    question: typeof raw.question === "string" && raw.question.trim() ? raw.question.trim() : null,
    cost_usd: costUsd,
    balance_usd: balanceUsd,
  };
}
