import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgressTab } from "@/components/ProgressTab";
import { SettingsListTab } from "@/components/SettingsListTab";
import { FriendsTab } from "@/components/FriendsTab";
import { GoalsListTab } from "@/components/goals/GoalsListTab";
import { UserAvatar } from "@/components/UserAvatar";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { useUserRank } from "@/hooks/use-user-rank";
import { useUsername } from "@/hooks/use-username";
import { RANK_ICONS, RANK_IMAGES } from "@/lib/ranks";
import { useSwipePriority } from "@/hooks/use-swipe-priority";

type ProfileTab = "goals" | "progress" | "friends" | "admin";

export const Route = createFileRoute("/_authenticated/profile/")({
  validateSearch: (search: Record<string, unknown>): { tab?: ProfileTab } => {
    const tab = search["tab"];
    return tab === "progress" || tab === "admin" || tab === "goals" || tab === "friends"
      ? { tab }
      : {};
  },

  head: () => ({
    meta: [
      { title: "Profil & Ziel-Werte – Kalorien und Makros" },
      {
        name: "description",
        content:
          "Hinterlege Gewicht, Größe, Alter und Ziel – daraus werden Ziel-Kalorien und Makros berechnet.",
      },
      { property: "og:title", content: "Profil & Ziel-Werte" },
      {
        property: "og:description",
        content: "Ziel-Kalorien und Makro-Verteilung aus deinen Angaben berechnen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const TABS: [ProfileTab, string][] = [
  ["goals", "Ziele"],
  ["progress", "Fortschritt"],
  ["friends", "Freunde"],
  ["admin", "Verwaltung"],
];

/** Profilbild mit Rang-Icon für den Profil-Header. */
function ProfileHeaderMeta() {
  const { rank } = useUserRank();
  const { avatarUrl } = useUserAvatar();
  const { username } = useUsername();
  const tier = rank?.current;
  const cfg = tier ? RANK_ICONS[tier.group] : RANK_ICONS.bronze;
  const image = tier ? RANK_IMAGES[tier.key] : RANK_IMAGES.bronze_1;
  const Icon = cfg.icon;

  return (
    <div className="relative -mt-1 self-center">
      <UserAvatar label={username ?? "?"} avatarUrl={avatarUrl} className="h-16 w-16 text-xl" />
      <span
        className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center overflow-hidden rounded-full bg-background ring-2 ring-background shadow-sm"
        title={tier ? `Rang ${tier.label}` : undefined}
      >
        {image ? (
          <img src={image} alt="" className="h-4 w-4 object-contain" aria-hidden />
        ) : (
          <span
            className="grid h-4 w-4 place-items-center rounded-full"
            style={{
              background: `linear-gradient(135deg, ${cfg.from}, ${cfg.to})`,
            }}
            aria-hidden
          >
            <Icon className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
          </span>
        )}
      </span>
    </div>
  );
}

function ProfilePage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const active: ProfileTab = tab ?? "goals";
  const activeIndex = TABS.findIndex(([value]) => value === active);
  useSwipePriority({
    onSwipeLeft: () =>
      void navigate({
        search: { tab: TABS[Math.min(activeIndex + 1, TABS.length - 1)]![0] },
        replace: true,
      }),
    onSwipeRight: () =>
      void navigate({
        search: { tab: TABS[Math.max(activeIndex - 1, 0)]![0] },
        replace: true,
      }),
  });

  return (
    <div className="liquid-glass refract-test font-display mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between gap-3 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
        <ProfileHeaderMeta />
      </div>

      <Tabs
        value={active}
        onValueChange={(v) => void navigate({ search: { tab: v as ProfileTab }, replace: true })}
      >
        <TabsList className="grid h-auto w-full grid-cols-4 gap-1 rounded-2xl border border-border bg-muted/70 p-1 shadow-inner">
          {TABS.map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-xl px-1 py-2 text-[13px] font-medium text-muted-foreground transition-all data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:[background:var(--primary-gradient)]"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="goals" className="mt-4">
          <GoalsListTab />
        </TabsContent>
        <TabsContent value="progress" className="mt-4">
          <ProgressTab />
        </TabsContent>
        <TabsContent value="friends" className="mt-4">
          <FriendsTab />
        </TabsContent>

        <TabsContent value="admin" className="mt-4">
          <SettingsListTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
