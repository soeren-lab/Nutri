// Guarded PWA service-worker registration.
// - Never registers in dev, iframe, or Lovable preview hosts.
// - Supports `?sw=off` kill switch.
// - Unregisters any stale /sw.js in refused contexts.
const SW_PATH = "/sw.js";

const LOVABLE_PREVIEW_HOSTS = ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"];

function isLovablePreviewHost(host: string): boolean {
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  return LOVABLE_PREVIEW_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

async function unregisterMatching(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
          return url.endsWith(SW_PATH);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    /* noop */
  }
}

export async function registerPwa(): Promise<void> {
  if (typeof window === "undefined") {
    console.warn("[pwa] kein window, breche ab");
    return;
  }
  if (!("serviceWorker" in navigator)) {
    console.warn("[pwa] navigator.serviceWorker nicht vorhanden");
    return;
  }

  const url = new URL(window.location.href);
  const inIframe = window.self !== window.top;
  const host = window.location.hostname;
  const refuse =
    !import.meta.env.PROD ||
    inIframe ||
    isLovablePreviewHost(host) ||
    url.searchParams.get("sw") === "off";
  console.warn(
    `[pwa] host=${host} PROD=${import.meta.env.PROD} inIframe=${inIframe} refuse=${refuse}`,
  );

  if (refuse) {
    await unregisterMatching();
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
    console.warn(
      `[pwa] SW registriert: active=${!!reg.active} installing=${!!reg.installing} waiting=${!!reg.waiting} scope=${reg.scope}`,
    );
  } catch (err) {
    console.warn("[pwa] SW registration failed", err);
  }
}
