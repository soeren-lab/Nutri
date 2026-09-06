import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getCookbookCoverSignedUrl, type CookbookWithCount } from "@/lib/cookbooks";

export function CookbookCard({ cookbook }: { cookbook: CookbookWithCount }) {
  const { data: coverUrl } = useQuery({
    queryKey: ["cookbook-cover", cookbook.cover_image_url],
    queryFn: () =>
      cookbook.cover_image_url ? getCookbookCoverSignedUrl(cookbook.cover_image_url) : Promise.resolve(null),
    enabled: !!cookbook.cover_image_url,
    staleTime: 1000 * 60 * 60,
  });
  const [broken, setBroken] = useState(false);

  return (
    <Link
      to="/cookbooks/$id"
      params={{ id: cookbook.id }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {coverUrl && !broken ? (
          <img
            src={coverUrl}
            alt={cookbook.title}
            onError={() => setBroken(true)}
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <BookOpen className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {cookbook.is_shared && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Users className="h-3 w-3" /> Geteilt
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground sm:text-base">
          {cookbook.title}
        </h3>
        {cookbook.is_shared && (
          <p className="text-xs text-muted-foreground">
            Geteilt von {cookbook.owner_username ? `@${cookbook.owner_username}` : "einem Nutzer"}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {cookbook.recipe_count} Rezept{cookbook.recipe_count === 1 ? "" : "e"}
        </p>
      </div>
    </Link>
  );
}
