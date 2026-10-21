import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createTokenClient } from "@/lib/db-client";

function b64urlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Prüft ein HS256-JWT der NAS-API (Secret: JWT_SECRET) per Web Crypto – ohne Netzwerkzugriff. */
async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown>> {
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) throw new Error("Unauthorized: Invalid token");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlToBytes(sig) as BufferSource,
    new TextEncoder().encode(`${h}.${p}`) as BufferSource,
  );
  if (!ok) throw new Error("Unauthorized: Invalid token");
  const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))) as Record<string, unknown>;
  if (typeof claims.exp === "number" && claims.exp < Date.now() / 1000) {
    throw new Error("Unauthorized: Token expired");
  }
  return claims;
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const secret = process.env.JWT_SECRET;
    const apiUrl = process.env.NAS_API_URL;
    if (!secret || !apiUrl) {
      const missing = [...(!secret ? ["JWT_SECRET"] : []), ...(!apiUrl ? ["NAS_API_URL"] : [])];
      throw new Error(`Server nicht konfiguriert (fehlt: ${missing.join(", ")}).`);
    }

    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
    if (!authHeader.startsWith("Bearer "))
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    const token = authHeader.slice(7);

    const claims = await verifyJwt(token, secret);
    if (typeof claims.sub !== "string") throw new Error("Unauthorized: No user ID found in token");

    return next({
      context: {
        // Token-gebundener Client gegen die NAS-API (RLS-äquivalente Regeln gelten wie in der App).
        supabase: createTokenClient(apiUrl, token) as unknown as SupabaseClient<Database>,
        userId: claims.sub,
        claims,
      },
    });
  },
);
