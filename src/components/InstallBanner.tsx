import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "pwa-install-dismissed";

// Chromium's beforeinstallprompt event shape.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iosPattern = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect touch + Safari to catch it.
  const iPadOs = ua.includes("Mac") && "ontouchend" in document;
  return iosPattern || iPadOs;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    (window.navigator as { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    }
    function onInstalled() {
      setDeferred(null);
      setShowIos(false);
      setHidden(true);
      localStorage.setItem(DISMISS_KEY, "1");
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS fallback: no beforeinstallprompt available.
    if (isIos()) {
      setShowIos(true);
      setHidden(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    localStorage.setItem(DISMISS_KEY, "1");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
    setDeferred(null);
    setHidden(true);
  }

  if (hidden) return null;
  if (!deferred && !showIos) return null;

  return (
    <div
      role="dialog"
      aria-label="App installieren"
      className="fixed inset-x-0 top-0 z-50 mx-auto flex max-w-xl items-center gap-3 border-b border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:inset-x-4 sm:top-3 sm:rounded-2xl sm:border"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Download className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium">App installieren</div>
        {deferred ? (
          <p className="truncate text-xs text-muted-foreground">
            Rezepte als App auf deinem Gerät nutzen.
          </p>
        ) : (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="truncate">Tippe auf</span>
            <Share className="inline h-3.5 w-3.5 shrink-0" />
            <span className="truncate">→ „Zum Home-Bildschirm"</span>
          </p>
        )}
      </div>
      {deferred && (
        <Button size="sm" onClick={install} className="shrink-0">
          Installieren
        </Button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hinweis schließen"
        className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
