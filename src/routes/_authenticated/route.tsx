import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AchievementWatcher } from "@/components/AchievementWatcher";
import { PatchNoteModal } from "@/components/PatchNoteModal";
import { SeasonStartModal } from "@/components/SeasonStartModal";

import { UsernameOnboardingDialog } from "@/components/UsernameOnboardingDialog";
import { AppHeader } from "@/components/AppHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TabBar } from "@/components/TabBar";



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
    <div className="min-h-screen bg-background">
      <AppHeader />
      <OfflineBanner />
      <main
        className="mx-auto max-w-6xl px-4 py-6"
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


