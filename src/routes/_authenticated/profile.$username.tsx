import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Flame, Trophy } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { MasonryGrid } from "@/components/MasonryGrid";
import { CommunityCard } from "@/components/CommunityCard";
import { RankBadge } from "@/components/RankBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSignedImage, useSignedIngredientImage } from "@/hooks/use-signed-image";
import { useRecipeCalorieRange } from "@/hooks/use-recipe-calorie-range";
import { DEFAULT_INGREDIENT_CATEGORY } from "@/lib/categories";
import { sharedWithMeQuery, myFriendsQuery } from "@/lib/friends";
import { friendComparisonQuery } from "@/lib/friend-comparison";
import { currentSeasonQuery } from "@/lib/seasons";
import { friendCookbooksQuery } from "@/lib/cookbooks";
import { CookbookCard } from "@/components/CookbookCard";
import { RANK_ICONS } from "@/lib/ranks";
import {
  publicProfileQuery,
  publishedIngredientsByUserQuery,
  publishedRecipesByUserQuery,
} from "@/lib/public-profile";

import { rankForPoints } from "@/lib/ranks";
import { importCommunityIngredient } from "@/lib/community";
import { importCommunityRecipe } from "@/lib/community-recipes";
import { ingredientsMasterQuery } from "@/lib/ingredients-master";
import { recipesQuery } from "@/lib/recipes";
import type { CommunityIngredient } from "@/lib/community";
import type { RecipeListItem } from "@/types/recipe";

export const Route = createFileRoute("/_authenticated/profile/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} – Community-Profil` },
      {
        name: "description",
        content: `Veröffentlichte Rezepte und Zutaten von @${params.username} im Community-Hub.`,
      },
      { property: "og:title", content: `@${params.username} – Community-Profil` },
      {
        property: "og:description",
        content: `Veröffentlichte Rezepte und Zutaten von @${params.username}.`,
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicProfilePage,
});

/** Führt öffentliche und privat geteilte Inhalte ohne Duplikate zusammen. */
function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const seen = new Set(base.map((b) => b.id));
  return [...base, ...extra.filter((e) => !seen.has(e.id))];
}

function PublicProfilePage() {

  const { username } = Route.useParams();
  const profileQ = useQuery(publicProfileQuery(username));
  const profile = profileQ.data ?? null;
  const uid = profile?.userId ?? "";

  const recipesQ = useQuery({
    ...publishedRecipesByUserQuery(uid),
    enabled: !!uid,
  });
  const ingredientsQ = useQuery({
    ...publishedIngredientsByUserQuery(uid),
    enabled: !!uid,
  });
  // Inhalte, die dieser Nutzer gezielt nur mit mir geteilt hat.
  const sharedQ = useQuery({
    ...sharedWithMeQuery(uid),
    enabled: !!uid,
  });

  const cookbooksQ = useQuery({
    ...friendCookbooksQuery(uid),
    enabled: !!uid,
  });
  const seasonQ = useQuery(currentSeasonQuery());
  const friendsQ = useQuery(myFriendsQuery());
  const comparisonQ = useQuery(friendComparisonQuery());

  const qc = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { data: ownRecipes = [] } = useQuery(recipesQuery());
  const { data: ownIngredients = [] } = useQuery(ingredientsMasterQuery(true));

  const importedRecipeIds = useMemo(
    () => new Set(ownRecipes.map((r) => r.source_recipe_id).filter(Boolean) as string[]),
    [ownRecipes],
  );
  const importedIngredientIds = useMemo(
    () =>
      new Set(
        ownIngredients.map((i) => i.source_ingredient_id).filter(Boolean) as string[],
      ),
    [ownIngredients],
  );

  const importRecipeMut = useMutation({
    mutationFn: (id: string) => importCommunityRecipe(id),
    onMutate: (id: string) => setPendingId(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      void qc.invalidateQueries({ queryKey: ["ingredients_master"] });
      void qc.invalidateQueries({ queryKey: ["brands"] });
      void qc.invalidateQueries({ queryKey: ["recipe_updates"] });
      toast.success("Rezept hinzugefügt");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
    onSettled: () => setPendingId(null),
  });

  const importIngredientMut = useMutation({
    mutationFn: (src: CommunityIngredient) => importCommunityIngredient(src),
    onMutate: (src: CommunityIngredient) => setPendingId(src.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ingredients_master"] });
      void qc.invalidateQueries({ queryKey: ["brands"] });
      void qc.invalidateQueries({ queryKey: ["ingredient_updates"] });
      toast.success("Zutat hinzugefügt");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
    onSettled: () => setPendingId(null),
  });

  if (profileQ.isLoading) return <LoadingSpinner />;

  if (!profile)
    return (
      <div className="space-y-4">
        <BackLink />
        <EmptyState
          title="Profil nicht gefunden"
          description={`Es gibt keinen Nutzer @${username}.`}
        />
      </div>
    );

  const rankInfo = rankForPoints(profile.totalPoints);
  const rank = rankInfo.current;
  const rankColors = RANK_ICONS[rank.group];
  const cookbooks = cookbooksQ.data ?? [];
  const friendEntry = friendsQ.data?.find((f) => f.userId === uid) ?? null;
  const friendDays = friendEntry?.friendsSince
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(friendEntry.friendsSince).getTime()) / 86_400_000,
        ),
      )
    : null;
  const ranking = [...(comparisonQ.data ?? [])].sort(
    (a, b) => b.totalPoints - a.totalPoints,
  );
  const placement = ranking.findIndex((e) => e.userId === uid);
  const recipes = mergeById(recipesQ.data ?? [], sharedQ.data?.recipes ?? []);
  const ingredients = mergeById(
    ingredientsQ.data ?? [],
    sharedQ.data?.ingredients ?? [],
  );
  const sharedCount =
    (sharedQ.data?.recipes.length ?? 0) + (sharedQ.data?.ingredients.length ?? 0);


  return (
    <div className="space-y-4">
      <BackLink />

      <header
        className="relative overflow-hidden rounded-2xl border border-border p-4 shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${rankColors.from}26, ${rankColors.to}14 55%, transparent)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full blur-3xl"
          style={{ background: `${rankColors.from}33` }}
          aria-hidden
        />
        <div className="relative flex items-center gap-4">
          <UserAvatar
            label={profile.username}
            avatarUrl={profile.avatarUrl}
            className="h-16 w-16 text-lg"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="truncate text-lg font-semibold">@{profile.username}</h1>
            <p
              className="text-xs font-semibold"
              style={{ color: rankColors.from }}
            >
              {rank.label}
            </p>
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Flame className="h-3.5 w-3.5 fill-orange-500 text-orange-500" />
              <span className="font-semibold text-foreground">
                {profile.currentStreakDays}
              </span>
              Tage Streak
            </p>
          </div>
          <RankBadge tier={rank} size={56} />
        </div>

        <div className="relative mt-4 rounded-xl border border-border/60 bg-card/70 p-3 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              {seasonQ.data?.name ?? "Aktuelle Season"}
            </span>
            <span className="text-sm font-semibold">
              {profile.totalPoints.toLocaleString("de-DE")} Punkte
            </span>
          </div>
          {rankInfo.next && (
            <>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(rankInfo.progress * 100)}%`,
                    background: `linear-gradient(90deg, ${rankColors.from}, ${rankColors.to})`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Noch {rankInfo.pointsToNext.toLocaleString("de-DE")} Punkte bis{" "}
                {rankInfo.next.label}
              </p>
            </>
          )}
        </div>

        {(friendDays !== null || placement >= 0) && (
          <Link
            to="/profile"
            className="relative mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {friendDays !== null && (
              <span>
                Ihr seid seit{" "}
                <span className="font-semibold text-foreground">{friendDays}</span>{" "}
                {friendDays === 1 ? "Tag" : "Tagen"} befreundet
              </span>
            )}
            {friendDays !== null && placement >= 0 && <span>·</span>}
            {placement >= 0 && (
              <span>
                Aktuell{" "}
                <span className="font-semibold text-foreground">#{placement + 1}</span>{" "}
                in eurem Vergleich
              </span>
            )}
          </Link>
        )}
      </header>

      {sharedCount > 0 && (
        <p className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
          {sharedCount} {sharedCount === 1 ? "Inhalt" : "Inhalte"} wurden privat nur mit
          dir geteilt und sind hier zusätzlich sichtbar.
        </p>
      )}



      <Tabs defaultValue="recipes">
        <TabsList className="w-full">
          <TabsTrigger value="recipes" className="flex-1">
            Rezepte ({recipes.length})
          </TabsTrigger>
          <TabsTrigger value="ingredients" className="flex-1">
            Zutaten ({ingredients.length})
          </TabsTrigger>
          <TabsTrigger value="cookbooks" className="flex-1">
            Kochbücher ({cookbooks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recipes" className="mt-3">
          {recipesQ.isLoading ? (
            <LoadingSpinner />
          ) : recipes.length === 0 ? (
            <EmptyState
              title="Keine veröffentlichten Rezepte"
              description="Dieser Nutzer hat noch nichts geteilt."
            />
          ) : (
            <MasonryGrid>
              {recipes.map((r) => (
                <ProfileRecipeCard
                  key={r.id}
                  recipe={r}
                  profile={profile}
                  added={importedRecipeIds.has(r.id)}
                  adding={pendingId === r.id}
                  onAdd={() => importRecipeMut.mutate(r.id)}
                />
              ))}
            </MasonryGrid>
          )}
        </TabsContent>

        <TabsContent value="ingredients" className="mt-3">
          {ingredientsQ.isLoading ? (
            <LoadingSpinner />
          ) : ingredients.length === 0 ? (
            <EmptyState
              title="Keine veröffentlichten Zutaten"
              description="Dieser Nutzer hat noch nichts geteilt."
            />
          ) : (
            <MasonryGrid>
              {ingredients.map((i) => (
                <ProfileIngredientCard
                  key={i.id}
                  item={i}
                  profile={profile}
                  added={importedIngredientIds.has(i.id)}
                  adding={pendingId === i.id}
                  onAdd={() => importIngredientMut.mutate(i)}
                />
              ))}
            </MasonryGrid>
          )}
        </TabsContent>

        <TabsContent value="cookbooks" className="mt-3">
          {cookbooksQ.isLoading ? (
            <LoadingSpinner />
          ) : cookbooks.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title="Keine geteilten Kochbücher"
              description="Dieser Nutzer hat noch kein Kochbuch mit dir geteilt."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cookbooks.map((c) => (
                <CookbookCard key={c.id} cookbook={c} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/recipes"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Zurück
    </Link>
  );
}

type Profile = { username: string; avatarUrl: string | null };

function ProfileRecipeCard({
  recipe,
  profile,
  added,
  adding,
  onAdd,
}: {
  recipe: RecipeListItem;
  profile: Profile;
  added: boolean;
  adding: boolean;
  onAdd: () => void;
}) {
  const { data: imageUrl } = useSignedImage(recipe.image_url);
  const { label: kcalLabel } = useRecipeCalorieRange(recipe);
  const cats = recipe.categories?.length
    ? recipe.categories
    : recipe.category
      ? [recipe.category]
      : [];
  return (
    <CommunityCard
      id={recipe.id}
      title={recipe.title}
      metric={kcalLabel}
      category={cats[0] ?? DEFAULT_INGREDIENT_CATEGORY}
      imageUrl={imageUrl}
      authorLabel={`@${profile.username}`}
      authorAvatarUrl={profile.avatarUrl}
      to="/recipes/$id"
      params={{ id: recipe.id }}
      added={added}
      adding={adding}
      onAdd={onAdd}
    />
  );
}

function ProfileIngredientCard({
  item,
  profile,
  added,
  adding,
  onAdd,
}: {
  item: CommunityIngredient;
  profile: Profile;
  added: boolean;
  adding: boolean;
  onAdd: () => void;
}) {
  const { data: imageUrl } = useSignedIngredientImage(item.image_url);
  const unitLabel = item.unit === "Stk" ? "Stück" : item.unit;
  const per = unitLabel === "Stück" ? "/Stück" : `/100${unitLabel}`;
  return (
    <CommunityCard
      id={item.id}
      title={item.name}
      metric={`${item.calories ?? "–"} kcal${per}`}
      category={item.category || DEFAULT_INGREDIENT_CATEGORY}
      imageUrl={imageUrl}
      authorLabel={`@${profile.username}`}
      authorAvatarUrl={profile.avatarUrl}
      added={added}
      adding={adding}
      onAdd={onAdd}
    />
  );
}
