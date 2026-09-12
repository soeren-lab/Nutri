// Server-only: sendet Push-Notifications über die FCM HTTP v1 API.
// Bewusst ohne "firebase-admin" (riesiges, Node-lastiges Paket, das auf
// Cloudflare Workers nicht läuft) - reines fetch() + Web Crypto stattdessen.

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type FcmResult = {
  sent: number;
  failed: number;
  errors: string[];
};

let cachedAccessToken: { token: string; expiresAt: number } | undefined;

function getServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable. Firebase-Projekt noch nicht eingerichtet.",
    );
  }
  return JSON.parse(raw) as ServiceAccount;
}

function base64Url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signJwt(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64Url(signature)}`;
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const assertion = await signJwt(account);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`FCM OAuth2 token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

/** Sendet dieselbe Notification an eine Liste von FCM-Tokens. Fehler pro Token einzeln. */
export async function sendFcmBroadcast(
  tokens: string[],
  notification: { title: string; body: string },
): Promise<FcmResult> {
  if (tokens.length === 0) return { sent: 0, failed: 0, errors: [] };

  const account = getServiceAccount();
  const accessToken = await getAccessToken(account);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;

  const results = await Promise.allSettled(
    tokens.map((token) =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: { token, notification } }),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      }),
    ),
  );

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => String(r.reason));
  return {
    sent: results.length - errors.length,
    failed: errors.length,
    errors,
  };
}
