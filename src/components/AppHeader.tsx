import { Link, useMatches } from "@tanstack/react-router";
import { useState } from "react";
import { Bell } from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { ingredientUpdatesQuery } from "@/lib/community";
import { recipeUpdatesQuery } from "@/lib/community-recipes";
import { acceptedNotificationsQuery, incomingRequestsQuery } from "@/lib/friends";
import { UpdatesSheet } from "@/components/UpdatesSheet";
import { UserAvatar } from "@/components/UserAvatar";
import { useUserRank } from "@/hooks/use-user-rank";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { useUsername } from "@/hooks/use-username";
import { RANK_ICONS, RANK_IMAGES } from "@/lib/ranks";

export function AppHeader() {
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const matches = useMatches();
  const isProfileTab = matches.some(
    (m) =>
      m.routeId === "/_authenticated/profile/" || m.routeId === "/_authenticated/profile/progress",
  );
  const { data: ingredientUpdates = [] } = useQuery({
    ...ingredientUpdatesQuery(),
    staleTime: 60_000,
  });
  const { data: recipeUpdates = [] } = useQuery({
    ...recipeUpdatesQuery(),
    staleTime: 60_000,
  });
  const { data: friendRequests = [] } = useQuery({
    ...incomingRequestsQuery(),
    staleTime: 60_000,
  });
  const { data: acceptedNotes = [] } = useQuery({
    ...acceptedNotificationsQuery(),
    staleTime: 60_000,
  });
  const notificationCount =
    ingredientUpdates.length + recipeUpdates.length + friendRequests.length + acceptedNotes.length;

  return (
    <header
      // "app-header": Liquid-Glass-Übersteuerung (siehe styles.css) auf den
      // fünf Haupttab-Seiten – Verlauf statt Transluzenz+Blur, damit der
      // Header nicht mehr von backdrop-filter abhängt.
      className="app-header sticky top-0 z-30 border-b border-purple-100/60 bg-background/70 backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Link
          to="/recipes"
          className="group flex h-10 shrink-0 items-center"
          aria-label="NUTRI – Startseite"
        >
          <span
            className="font-display bg-clip-text text-[1.65rem] leading-none font-black tracking-[0.14em] text-transparent transition-opacity group-active:opacity-80"
            style={{ backgroundImage: "var(--primary-gradient)" }}
          >
            NUTRI
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUpdatesOpen(true)}
            aria-label={`Benachrichtigungen${notificationCount > 0 ? ` (${notificationCount})` : ""}`}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground active:scale-95"
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {notificationCount}
              </span>
            )}
          </button>
          {!isProfileTab && <ProfileAvatarButton />}
        </div>
      </div>

      <UpdatesSheet open={updatesOpen} onOpenChange={setUpdatesOpen} />
    </header>
  );
}

/** Profilbild mit kleinem Rang-Badge; führt zum Profil-Tab. */
function ProfileAvatarButton() {
  const { rank } = useUserRank();
  const { avatarUrl } = useUserAvatar();
  const { username } = useUsername();
  const tier = rank?.current;
  const cfg = tier ? RANK_ICONS[tier.group] : RANK_ICONS.bronze;
  const image = tier ? RANK_IMAGES[tier.key] : RANK_IMAGES.bronze_1;
  const Icon = cfg.icon;

  return (
    <Link
      to="/profile"
      aria-label={`Profil${tier ? ` – Rang ${tier.label}` : ""}`}
      className="relative flex h-10 w-10 items-center justify-center transition-transform active:scale-95"
    >
      <UserAvatar label={username ?? "?"} avatarUrl={avatarUrl} className="h-9 w-9" />
      <span
        className="absolute -bottom-0.5 -right-0.5 grid h-[18px] w-[18px] place-items-center overflow-hidden rounded-full bg-background ring-1 ring-background"
        title={tier ? `Rang ${tier.label}` : undefined}
      >
        {image ? (
          <img src={image} alt="" className="h-[16px] w-[16px] object-contain" aria-hidden />
        ) : (
          <span
            className="grid h-[16px] w-[16px] place-items-center rounded-full"
            style={{ background: `linear-gradient(135deg, ${cfg.from}, ${cfg.to})` }}
            aria-hidden
          >
            <Icon className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
          </span>
        )}
      </span>
    </Link>
  );
}
