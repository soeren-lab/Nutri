import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AchievementWatcher } from "@/components/AchievementWatcher";
import { PatchNoteModal } from "@/components/PatchNoteModal";
import { SeasonStartModal } from "@/components/SeasonStartModal";

import { UsernameOnboardingDialog } from "@/components/UsernameOnboardingDialog";
import { AppHeader } from "@/components/AppHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TabBar } from "@/components/TabBar";
import { GlassAmbientWash } from "@/components/GlassAmbientWash";
import { useExperimentalMode } from "@/hooks/use-experimental-mode";
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation";
import {
  SwipeRegistryProvider,
  useSwipeRegistry,
  topSwipeHandlers,
} from "@/hooks/use-swipe-priority";

const SWIPE_TAB_ORDER = ["/recipes", "/discover", "/ingredients", "/planner", "/profile"];
const RECIPE_DETAIL_PATTERN = /^\/recipes\/[^/]+\/?$/;
// Dieselben fünf Haupttab-Übersichten bekommen den Liquid-Glass-Look
// (siehe styles.css ".liquid-glass"/".wash-boost") – Detail-/Bearbeiten-/
// Einstellungs-Routen bewusst nicht (kein startsWith-Match, siehe unten).
const LIQUID_GLASS_ROUTES = new Set(SWIPE_TAB_ORDER);

/**
 * SVG-Filter für die Liquid-Glass-Refraktion (feTurbulence + feDisplacement-
 * Map), zentral einmal gerendert statt pro Seite dupliziert – Karten
 * verweisen darauf über backdrop-filter: url(#liquidRefract) (siehe
 * styles.css, @supports-abgesichert).
 */
function LiquidGlassRefractFilter() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="liquidRefract" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.02"
            numOctaves={2}
            seed={7}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={34}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() liest die lokal gespeicherte Session (kein Netzwerk-Request) –
    // wichtig für Offline-Nutzung. getUser() würde bei jedem Routenwechsel einen
    // Server-Request auslösen, der offline fehlschlägt und den Router in eine
    // Neulade-Schleife treibt.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <SwipeRegistryProvider>
      <AuthedLayoutInner />
    </SwipeRegistryProvider>
  );
}

function AuthedLayoutInner() {
  const { enabled: glassEnabled } = useExperimentalMode();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const swipeRegistry = useSwipeRegistry();

  const tabIndex = SWIPE_TAB_ORDER.indexOf(pathname);
  const isRecipeDetail = RECIPE_DETAIL_PATTERN.test(pathname);

  const isMainTab = tabIndex >= 0;

  // Screens mit eigener Unter-Navigation (Tabs, Tages-Auswahl) haben über
  // swipeRegistry immer Vorrang. Danach: Haupt-Tabs wechseln sich per Swipe
  // durch; Rezept-Detail geht gezielt zurück zur Liste; jede andere
  // Unterseite (Formulare, Einstellungen usw.) geht per Swipe einfach einen
  // Schritt in der Navigation zurück.
  function fallbackSwipe() {
    if (isMainTab) return;
    if (isRecipeDetail) {
      void navigate({ to: "/recipes" });
      return;
    }
    window.history.back();
  }

  useSwipeNavigation(
    () => {
      const top = topSwipeHandlers(swipeRegistry);
      if (top) {
        top.onSwipeLeft();
        return;
      }
      if (isMainTab && tabIndex < SWIPE_TAB_ORDER.length - 1) {
        void navigate({ to: SWIPE_TAB_ORDER[tabIndex + 1] });
      } else {
        fallbackSwipe();
      }
    },
    () => {
      const top = topSwipeHandlers(swipeRegistry);
      if (top) {
        top.onSwipeRight();
        return;
      }
      if (isMainTab && tabIndex > 0) {
        void navigate({ to: SWIPE_TAB_ORDER[tabIndex - 1] });
      } else {
        fallbackSwipe();
      }
    },
  );

  // Liquid-Glass-Seiten (Planer + die Haupttab-Übersichten) bekommen den
  // kräftigeren Wash (siehe styles.css ".wash-boost") – der bisherige, blasse
  // Wash gab der Refraktion praktisch nur Weiß zum Verbiegen. Exakter
  // Pfad-Abgleich (kein startsWith): Detail-/Bearbeiten-/Einstellungs-Routen
  // (z.B. "/recipes/$id", "/profile/settings/...") sollen NICHT mitgeboostet
  // werden – das ist bewusst nur für die Haupttab-Übersichten gedacht.
  const isLiquidGlassRoute = LIQUID_GLASS_ROUTES.has(pathname);

  return (
    <div className={cn("min-h-screen bg-background", isLiquidGlassRoute && "wash-boost")}>
      {glassEnabled && <GlassAmbientWash />}
      {glassEnabled && <LiquidGlassRefractFilter />}
      <AppHeader />
      <OfflineBanner />
      <main
        className="relative mx-auto max-w-6xl px-4 py-6"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >
        <Outlet />
      </main>
      <TabBar />
      <AchievementWatcher />
      <UsernameOnboardingDialog />
      <PatchNoteModal />
      <SeasonStartModal />
    </div>
  );
}
