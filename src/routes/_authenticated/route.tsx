import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AchievementWatcher } from "@/components/AchievementWatcher";
import { PatchNoteModal } from "@/components/PatchNoteModal";
import { SeasonStartModal } from "@/components/SeasonStartModal";

import { UsernameOnboardingDialog } from "@/components/UsernameOnboardingDialog";
import { AppHeader } from "@/components/AppHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TabBar } from "@/components/TabBar";
import { GlassAmbientGlow } from "@/components/GlassAmbientGlow";
import { useExperimentalMode } from "@/hooks/use-experimental-mode";
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation";

const SWIPE_TAB_ORDER = ["/recipes", "/cookbooks", "/ingredients", "/planner", "/profile"];
const RECIPE_DETAIL_PATTERN = /^\/recipes\/[^/]+\/?$/;

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
  const { enabled: glassEnabled } = useExperimentalMode();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  const tabIndex = SWIPE_TAB_ORDER.indexOf(pathname);
  const isRecipeDetail = RECIPE_DETAIL_PATTERN.test(pathname);

  const swipeRef = useSwipeNavigation<HTMLElement>(
    tabIndex >= 0 && tabIndex < SWIPE_TAB_ORDER.length - 1
      ? () => void navigate({ to: SWIPE_TAB_ORDER[tabIndex + 1] })
      : isRecipeDetail
        ? () => void navigate({ to: "/recipes" })
        : null,
    tabIndex > 0
      ? () => void navigate({ to: SWIPE_TAB_ORDER[tabIndex - 1] })
      : isRecipeDetail
        ? () => void navigate({ to: "/recipes" })
        : null,
  );

  return (
    <div className="min-h-screen bg-background">
      {glassEnabled && <GlassAmbientGlow />}
      <AppHeader />
      <OfflineBanner />
      <main
        ref={swipeRef}
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
