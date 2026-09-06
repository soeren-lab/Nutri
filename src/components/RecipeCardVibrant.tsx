import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Flame, Heart, ImageIcon } from "lucide-react";
import type { RecipeListItem } from "@/types/recipe";
import { useSignedImage } from "@/hooks/use-signed-image";
import { useRecipeCalorieRange } from "@/hooks/use-recipe-calorie-range";
import { getCategoryGradient } from "@/lib/categories";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toggleFavorite, favoritesQuery } from "@/lib/recipes";
import { cn } from "@/lib/utils";


export function RecipeCardVibrant({
  recipe,
  isFavorite,
}: {
  recipe: RecipeListItem;
  isFavorite: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: imageUrl } = useSignedImage(recipe.image_url);
  const [broken, setBroken] = useState(false);
  const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);
  const { label: kcalLabel } = useRecipeCalorieRange(recipe);


  const cats =
    recipe.categories && recipe.categories.length > 0
      ? recipe.categories
      : recipe.category
        ? [recipe.category]
        : [];
  const primaryCategory = cats[0] ?? "Sonstiges";
  const gradient = getCategoryGradient(primaryCategory);

  const favMutation = useMutation({
    mutationFn: async ({ recipeId, isFav }: { recipeId: string; isFav: boolean }) => {
      if (!user) return;
      await toggleFavorite(user.id, recipeId, isFav);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["favorites", user.id] });
      }
    },
  });

  const isFav = isFavorite;

  return (
    <div
      onClick={() => navigate({ to: "/recipes/$id", params: { id: recipe.id } })}
      className="group relative flex flex-col overflow-hidden rounded-3xl p-4 text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
      style={{
        background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
        boxShadow: `0 10px 25px -8px ${gradient.shadow}`,
      }}
      aria-label={recipe.title}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate({ to: "/recipes/$id", params: { id: recipe.id } });
        }
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          favMutation.mutate({ recipeId: recipe.id, isFav });
        }}
        className={cn(
          "relative z-10 ml-auto flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          isFav
            ? "bg-white/20 text-white"
            : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white",
        )}
        aria-label={isFav ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
      >
        <Heart className={cn("h-4 w-4", isFav && "fill-current")} />
      </button>

      <div className="relative flex flex-1 gap-4">

        <div
          className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl border-2 border-white/80 bg-white/20 shadow-sm"
          style={{ boxShadow: `0 4px 12px ${gradient.shadow}` }}
        >
          {imageUrl && !broken ? (
            <img
              src={imageUrl}
              alt={recipe.title}
              onError={() => setBroken(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/60">
              <ImageIcon className="h-7 w-7" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h3 className="line-clamp-2 text-lg font-bold leading-tight text-white">
            {recipe.title}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {totalTime > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white/95 backdrop-blur-sm">
                <Clock className="h-3 w-3" />
                {totalTime} min
              </span>
            )}
            {kcalLabel && (
              <span
                className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white/95 backdrop-blur-sm tabular-nums"
                title="pro Portion"
              >
                <Flame className="h-3 w-3" />
                {kcalLabel}
              </span>
            )}
            {cats.slice(0, 1).map((c) => (
              <span
                key={c}
                className="truncate rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white/95 backdrop-blur-sm"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {recipe.tag && (
        <span className="relative mt-3 self-start rounded-full border border-white/40 bg-white/15 px-2.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {recipe.tag}
        </span>
      )}

    </div>
  );
}
