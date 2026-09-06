import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SearchInputWithBeam } from "@/components/SearchInputWithBeam";
import { EmptyState } from "@/components/EmptyState";
import { CategoryFilterChips } from "@/components/CategoryFilterChips";
import { MasonryGrid } from "@/components/MasonryGrid";
import { CommunityCard } from "@/components/CommunityCard";
import { useSignedImage } from "@/hooks/use-signed-image";
import { useRecipeCalorieRange } from "@/hooks/use-recipe-calorie-range";
import {
  communityRecipesQuery,
  favoritesQuery,
  recipesQuery,
  toggleFavorite,
} from "@/lib/recipes";
import { importCommunityRecipe } from "@/lib/community-recipes";
import { aggregateCategories } from "@/hooks/use-all-categories";
import { DEFAULT_INGREDIENT_CATEGORY } from "@/lib/categories";
import type { RecipeListItem } from "@/types/recipe";
import { toast } from "sonner";

type CommunityRecipe = RecipeListItem & {
  author_username?: string | null;
  author_avatar_url?: string | null;
  source_recipe_id?: string | null;
  user_id: string;
};

export function RecipeCommunityTab() {
  const { user } = useAuth();
  const uid = user?.id;
  const { data: own } = useSuspenseQuery(recipesQuery());
  const { data: list = [], isLoading } = useQuery(communityRecipesQuery());
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: favIds = [] } = useQuery({
    ...favoritesQuery(uid ?? ""),
    enabled: !!uid,
  });
  const favSet = useMemo(() => new Set(favIds), [favIds]);

  const favMut = useMutation({
    mutationFn: ({ id, isFav }: { id: string; isFav: boolean }) =>
      toggleFavorite(uid!, id, isFav),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const importedSourceIds = useMemo(
    () => new Set(own.map((r) => r.source_recipe_id).filter(Boolean) as string[]),
    [own],
  );

  const importMut = useMutation({
    mutationFn: (id: string) => importCommunityRecipe(id),
    onMutate: (id) => setPendingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["ingredients_master"] });
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["recipe_updates"] });
      toast.success("Rezept hinzugefügt");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
    onSettled: () => setPendingId(null),
  });

  const availableCategories = useMemo(() => aggregateCategories(list), [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      const matchS =
        !q || r.title.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q);
      const cats = r.categories?.length ? r.categories : r.category ? [r.category] : [];
      const matchC = selectedCats.length === 0 || selectedCats.some((c) => cats.includes(c));
      return matchS && matchC;
    });
  }, [list, search, selectedCats]);

  function toggleCat(c: string) {
    setSelectedCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        Community · Rezepte
      </div>

      <SearchInputWithBeam
        placeholder="Community durchsuchen…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {availableCategories.length > 0 && (
        <CategoryFilterChips
          compact
          categories={availableCategories}
          selected={selectedCats}
          onToggle={toggleCat}
          onClear={() => setSelectedCats([])}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          title="Noch nichts im Hub"
          description="Veröffentliche eigene Rezepte, damit andere sie nutzen können."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Keine Treffer" description="Passe Suche oder Filter an." />
      ) : (
        <MasonryGrid>
          {filtered.map((r) => (
            <RecipeCommunityCard
              key={r.id}
              recipe={r as CommunityRecipe}
              isOwn={uid != null && (r as CommunityRecipe).user_id === uid}
              added={importedSourceIds.has(r.id)}
              adding={pendingId === r.id}
              liked={favSet.has(r.id)}
              onToggleLike={
                uid ? () => favMut.mutate({ id: r.id, isFav: favSet.has(r.id) }) : undefined
              }
              onAdd={() => importMut.mutate(r.id)}
            />
          ))}
        </MasonryGrid>
      )}
    </div>
  );
}

function RecipeCommunityCard({
  recipe,
  isOwn,
  added,
  adding,
  liked,
  onToggleLike,
  onAdd,
}: {
  recipe: CommunityRecipe;
  isOwn: boolean;
  added: boolean;
  adding: boolean;
  liked: boolean;
  onToggleLike?: () => void;
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
      authorLabel={isOwn ? "du" : `@${recipe.author_username ?? "unbekannt"}`}
      authorAvatarUrl={recipe.author_avatar_url}
      authorUsername={recipe.author_username}
      isOwn={isOwn}
      to="/recipes/$id"
      params={{ id: recipe.id }}
      liked={liked}
      onToggleLike={onToggleLike}
      added={added}
      adding={adding}
      onAdd={onAdd}
    />
  );
}
