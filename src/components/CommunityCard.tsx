import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Download, Flame, Heart, Loader2 } from "lucide-react";
import { getCategoryColor, getCategoryGradient } from "@/lib/categories";
import { cn } from "@/lib/utils";

const PLACEHOLDER_RATIOS = ["4 / 5", "1 / 1", "3 / 4", "5 / 6", "6 / 5"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export type CommunityCardProps = {
  id: string;
  title: string;
  /** Prominente Kennzahl, z.B. "420 kcal" – neutral eingefärbt */
  metric?: string | null;
  /** Kategorie: steuert Platzhalter-Verlauf und Mini-Pill */
  category: string;
  imageUrl?: string | null;
  authorLabel: string;
  /** Optionales Profilbild – ersetzt den Buchstaben-Platzhalter ohne Layout-Änderung */
  authorAvatarUrl?: string | null;
  isOwn?: boolean;
  /** Username des Erstellers ohne "@" – macht Avatar/Label klickbar (fremdes Profil) */
  authorUsername?: string | null;

  /** Detailziel – macht den Bildbereich klickbar */
  to?: string;
  params?: Record<string, string>;
  liked?: boolean;
  onToggleLike?: () => void;
  onAdd?: () => void;
  added?: boolean;
  adding?: boolean;
};

function AuthorAvatar({
  label,
  avatarUrl,
  isOwn,
}: {
  label: string;
  avatarUrl?: string | null;
  isOwn?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/25 text-[9px] font-semibold text-white backdrop-blur",
        isOwn && "ring-1 ring-primary ring-offset-1 ring-offset-black/30",
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        label.replace(/^@/, "").charAt(0).toUpperCase()
      )}
    </span>
  );
}

export function CommunityCard({
  id,
  title,
  metric,
  category,
  imageUrl,
  authorLabel,
  authorAvatarUrl,
  authorUsername,
  isOwn = false,
  to,
  params,
  liked,

  onToggleLike,
  onAdd,
  added = false,
  adding = false,
}: CommunityCardProps) {
  const [ratio, setRatio] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const gradient = getCategoryGradient(category);
  const catColor = getCategoryColor(category);
  const fallbackRatio = PLACEHOLDER_RATIOS[hash(id) % PLACEHOLDER_RATIOS.length];
  const showImage = !!imageUrl && !broken;

  const media = (
    <>
      {showImage ? (
        <img
          src={imageUrl!}
          alt={title}
          loading="lazy"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight)
              setRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
          }}
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            backgroundImage: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
          }}
        >
          <span
            className="text-4xl font-semibold tracking-tight"
            style={{ color: gradient.accent, opacity: 0.9 }}
          >
            {title.trim().charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
    </>
  );

  return (
    <div className="break-inside-avoid overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div
        className="relative w-full overflow-hidden bg-muted"
        style={{ aspectRatio: ratio ?? fallbackRatio }}
      >
        {to ? (
          <Link
            to={to}
            params={params as never}
            className="absolute inset-0 block"
            aria-label={title}
          >
            {media}
          </Link>
        ) : (
          media
        )}

        {/* Ersteller unten links */}
        {authorUsername && !isOwn ? (
          <Link
            to="/profile/$username"
            params={{ username: authorUsername }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Profil von @${authorUsername} ansehen`}
            className="absolute bottom-2 left-2 flex max-w-[80%] items-center gap-1.5 rounded-full bg-black/25 px-1.5 py-0.5 backdrop-blur transition-colors hover:bg-black/40"
          >
            <AuthorAvatar label={authorLabel} avatarUrl={authorAvatarUrl} isOwn={isOwn} />
            <span className="truncate text-[11px] font-medium text-white drop-shadow">
              {authorLabel}
            </span>
          </Link>
        ) : (
          <div className="pointer-events-none absolute bottom-2 left-2 flex max-w-[80%] items-center gap-1.5">
            <AuthorAvatar label={authorLabel} avatarUrl={authorAvatarUrl} isOwn={isOwn} />
            <span className="truncate text-[11px] font-medium text-white drop-shadow">
              {authorLabel}
            </span>
          </div>
        )}


        {/* Aktionen oben rechts */}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          {onToggleLike && (
            <button
              type="button"
              aria-label={liked ? "Favorit entfernen" : "Als Favorit merken"}
              aria-pressed={liked}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleLike();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/30 backdrop-blur transition-colors hover:bg-black/40"
            >
              <Heart
                className={cn(
                  "h-4 w-4",
                  liked ? "fill-rose-500 text-rose-500" : "text-white",
                )}
              />
            </button>
          )}
          {onAdd && !isOwn && (
            <button
              type="button"
              disabled={added || adding}
              aria-label={added ? "Bereits hinzugefügt" : "Zu meiner Sammlung hinzufügen"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!added && !adding) onAdd();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition-colors hover:bg-black/40 disabled:opacity-80"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : added ? (
                <Check className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1 px-2.5 py-2">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{title}</h3>
        <div className="flex items-center gap-1.5">
          {metric && (
            <span className="flex items-center gap-1 text-xs font-semibold tabular-nums text-foreground">
              <Flame className="h-3 w-3 text-primary" />
              {metric}
            </span>
          )}
          <span
            className={cn(
              "truncate rounded-full border px-1.5 py-[1px] text-[10px] font-medium",
              catColor.bg,
              catColor.text,
              catColor.border,
            )}
          >
            {category}
          </span>
        </div>
      </div>
    </div>
  );
}
