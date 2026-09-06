import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, ChefHat, Clock, Flame, ImageIcon, LogIn, UserPlus } from "lucide-react";
import { getCookbookByShareToken, type SharedCookbookPayload } from "@/lib/cookbooks-shared.functions";
import { joinCookbookByToken } from "@/lib/cookbooks";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CategoryBadge } from "@/components/CategoryBadge";
import { isNativeApp } from "@/lib/platform";

export const Route = createFileRoute("/cookbooks/shared/$token")({
  ssr: false,
  component: SharedCookbookPage,
});

function SharedCookbookPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  const native = isNativeApp();
  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-cookbook", token],
    queryFn: () => getCookbookByShareToken({ data: { token } }),
    staleTime: 1000 * 60,
    enabled: !native,
  });

  const joinMut = useMutation({
    mutationFn: () => joinCookbookByToken(token),
    onSuccess: (cbId) => {
      toast.success("Kochbuch beigetreten");
      navigate({ to: "/cookbooks/$id", params: { id: cbId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  if (native) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <EmptyState
          title="In der App aktuell nicht verfügbar"
          description="Bitte öffne diesen Freigabelink im Browser."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-8 w-40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <EmptyState title="Kochbuch nicht gefunden" description="Der Link ist ungültig oder wurde entfernt." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ChefHat className="h-5 w-5" />
            </div>
            <span>Rezepte</span>
          </Link>
          {authed === false && (
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/auth">
                <LogIn className="h-4 w-4" /> Anmelden
              </Link>
            </Button>
          )}
          {authed && (
            <Button size="sm" onClick={() => joinMut.mutate()} disabled={joinMut.isPending} className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              {joinMut.isPending ? "…" : "Zu meinen Kochbüchern hinzufügen"}
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="relative aspect-[3/1] w-full bg-muted sm:aspect-[4/1]">
            {data.coverSignedUrl ? (
              <img src={data.coverSignedUrl} alt={data.cookbook.title} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <BookOpen className="h-10 w-10" />
              </div>
            )}
          </div>
          <div className="p-4">
            <h1 className="text-2xl font-semibold tracking-tight">{data.cookbook.title}</h1>
            {data.cookbook.description && (
              <p className="mt-1 text-sm text-muted-foreground">{data.cookbook.description}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {data.recipes.length} Rezept{data.recipes.length === 1 ? "" : "e"}
            </p>
          </div>
        </div>

        {data.recipes.length === 0 ? (
          <EmptyState title="Noch keine Rezepte" description="Dieses Kochbuch ist leer." />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {data.recipes.map((r) => (
              <SharedRecipeCard key={r.id} recipe={r} imageUrl={data.imageSignedUrls[r.id] ?? null} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SharedRecipeCard({
  recipe,
  imageUrl,
}: {
  recipe: SharedCookbookPayload["recipes"][number];
  imageUrl: string | null;
}) {
  const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);
  const kcal = recipe.calories != null ? Math.round(Number(recipe.calories)) : null;
  const cats =
    recipe.categories && recipe.categories.length > 0
      ? recipe.categories
      : recipe.category
        ? [recipe.category]
        : [];

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt={recipe.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold sm:text-base">{recipe.title}</h3>
        {cats.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {cats.slice(0, 2).map((c) => (
              <CategoryBadge key={c} name={c} className="px-1.5 py-0.5 text-[10px]" />
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          {totalTime > 0 ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {totalTime} min
            </span>
          ) : (
            <span />
          )}
          {kcal != null && (
            <span className="flex items-center gap-1 tabular-nums">
              <Flame className="h-3 w-3" /> {kcal} kcal
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
