import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planAtLeast } from "@/lib/plans";
import { scanItemSchema, type ScanItem } from "@/lib/photoNutrition";

/** Maximale Foto-Auswertungen pro User in einem rollierenden 24-h-Fenster. */
const PHOTO_SCAN_DAILY_LIMIT = 40;
const DEFAULT_MODEL = "claude-sonnet-5-5";

const candidateSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  unit: z.string().min(1).max(12),
});

/** Base64-JPEG (ohne data:-Präfix), ca. 2,2 MB Text-Grenze pro Bild. */
const base64Image = z.string().min(100).max(3_000_000);

const inputSchema = z
  .object({
    image: base64Image.optional(),
    refImage: base64Image.optional(),
    note: z.string().max(1000).optional(),
    previous: z.array(scanItemSchema).max(30).optional(),
    correction: z.string().max(1000).optional(),
    candidates: z.array(candidateSchema).max(400),
  })
  .refine((v) => !!v.image || (!!v.previous?.length && !!v.correction?.trim()), {
    message: "Foto oder Korrektur fehlt",
  });

const SYSTEM_PROMPT = `Du bist der Ernährungs-Assistent einer deutschsprachigen Tracking-App. Du zerlegst eine Mahlzeit auf einem Foto in einzelne Lebensmittel und schätzt die verzehrte Menge. Du berechnest KEINE Gesamt-Nährwerte, das macht die App selbst.

Regeln:
- Jede Position hat name (kurz, deutsch), amount und unit. Verwende "g" für feste Lebensmittel, "ml" für Flüssigkeiten und "Stück" nur, wenn die passende Bibliotheks-Zutat die Einheit Stück hat.
- Wähle für master_id bevorzugt einen Eintrag aus der Bibliotheksliste des Nutzers (nur IDs aus der Liste, nie erfinden). Wenn nichts passt, setze master_id auf null und gib per100 mit groben Richtwerten pro 100 g bzw. 100 ml an.
- Beachte den Zustand: Reis, Nudeln und Hülsenfrüchte auf dem Teller sind gekocht. Gibt es nur einen Rohwert-Eintrag, rechne die Menge auf das Rohgewicht um.
- Schätze realistische Mengen anhand von Tellergröße, Besteck und Proportionen. Gib low und high als plausible Spanne derselben Menge an (typisch plus/minus 15 bis 25 Prozent) und confidence (high, medium, low).
- Das Referenzfoto (falls vorhanden) zeigt Zutaten oder Packungen und die Notiz nennt Verstecktes (Öl, Butter, Käse, Sauce, Zucker). Nutze beides und lege Öle und Fette als eigene Position an, wenn sie verwendet wurden.
- Stelle höchstens eine Rückfrage (question), und nur, wenn eine Position mehr als etwa 60 kcal Unsicherheit hat und das Foto sie nicht klärt.
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
} as const;

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } };

/** Normalisiert die KI-Antwort: ungültige Positionen fallen weg, Spannen werden eingerahmt. */
function sanitizeItems(raw: unknown, candidateIds: ReadonlySet<string>): ScanItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ScanItem[] = [];
  for (const entry of raw) {
    const parsed = scanItemSchema.safeParse(entry);
    if (!parsed.success) continue;
    const item = parsed.data;
    out.push({
      ...item,
      master_id: item.master_id && candidateIds.has(item.master_id) ? item.master_id : null,
      low: Math.min(item.low, item.amount),
      high: Math.max(item.high, item.amount),
    });
  }
  return out;
}

/**
 * Wertet ein Essensfoto (plus optional Zutaten-Foto und Sprachnotiz) aus oder setzt eine
 * Korrektur des Nutzers um. Nur für den Max-Plan, serverseitig geprüft.
 */
export const analyzeMealPhoto = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { data: planRow, error: planError } = await context.supabase
      .from("user_plans")
      .select("plan")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (planError) throw new Error("Plan konnte nicht geprüft werden");
    const plan = planRow?.plan === "max" || planRow?.plan === "pro" ? planRow.plan : "free";
    if (!planAtLeast(plan, "max")) {
      throw new Error("Der Foto-Scan ist nur im Max-Plan verfügbar.");
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
      throw new Error("Foto-Scan ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt).");

    const isNewScan = !!data.image;
    if (isNewScan) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await context.supabase
        .from("photo_scan_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .gte("created_at", since);
      if (countError) throw new Error("Tageslimit konnte nicht geprüft werden");
      if ((count ?? 0) >= PHOTO_SCAN_DAILY_LIMIT) {
        throw new Error(
          `Tageslimit erreicht (${PHOTO_SCAN_DAILY_LIMIT} Foto-Scans in 24 Stunden). Bitte später erneut versuchen.`,
        );
      }
    }

    const content: AnthropicContent[] = [];
    if (data.image) {
      content.push({ type: "text", text: "Foto 1: das Essen auf dem Teller." });
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: data.image },
      });
    }
    if (data.refImage) {
      content.push({ type: "text", text: "Foto 2: Referenz (Zutaten, Packungen, Öl o. Ä.)." });
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: data.refImage },
      });
    }
    const library = data.candidates.map((c) => `${c.id} | ${c.name} | ${c.unit}`).join("\n");
    const parts: string[] = [
      `Bibliothek des Nutzers (id | Name | Einheit):\n${library || "(leer)"}`,
    ];
    if (data.note?.trim()) parts.push(`Notiz des Nutzers: ${data.note.trim()}`);
    if (data.previous?.length) {
      parts.push(`Bisherige Positionen (JSON): ${JSON.stringify(data.previous)}`);
    }
    if (data.correction?.trim()) parts.push(`Korrektur des Nutzers: ${data.correction.trim()}`);
    content.push({ type: "text", text: parts.join("\n\n") });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.PHOTO_SCAN_MODEL || DEFAULT_MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "report_meal" },
        messages: [{ role: "user", content }],
      }),
    });
    if (!response.ok) {
      console.error("[photo-scan] Anthropic-Fehler", response.status, await response.text());
      throw new Error("Die KI-Auswertung ist fehlgeschlagen. Bitte erneut versuchen.");
    }

    const json = (await response.json()) as {
      content?: Array<{ type: string; input?: unknown }>;
    };
    const block = json.content?.find((b) => b.type === "tool_use");
    const raw = (block?.input ?? {}) as {
      summary_name?: unknown;
      items?: unknown;
      question?: unknown;
    };
    const candidateIds = new Set(data.candidates.map((c) => c.id));
    const items = sanitizeItems(raw.items, candidateIds);
    if (items.length === 0) {
      throw new Error("Auf dem Foto wurde kein Essen erkannt. Bitte ein anderes Foto versuchen.");
    }

    if (isNewScan) {
      await context.supabase.from("photo_scan_log").insert({ user_id: context.userId });
    }

    return {
      summary_name:
        typeof raw.summary_name === "string" && raw.summary_name.trim()
          ? raw.summary_name.trim().slice(0, 80)
          : "Foto-Mahlzeit",
      items,
      question:
        typeof raw.question === "string" && raw.question.trim() ? raw.question.trim() : null,
    };
  });
