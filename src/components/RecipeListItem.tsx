import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clock, Flame, ImageIcon } from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import type { RecipeListItem as RecipeListItemType } from "@/types/recipe";
import { useSignedImage } from "@/hooks/use-signed-image";
import { useNutritionColor } from "@/hooks/use-nutrition-color";
import { nutritionPerServing } from "@/lib/componentNutrition";
import { useRecipeCalorieRange } from "@/hooks/use-recipe-calorie-range";

export function RecipeListItem({ recipe }: { recipe: RecipeListItemType }) {
  const { data: imageUrl } = useSignedImage(recipe.image_url);
  const [broken, setBroken] = useState(false);
  const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);
  const perServing = useMemo(() => nutritionPerServing(recipe), [recipe]);
  const caloriesPerServing = perServing.calories;
  const proteinPerServing = perServing.protein_g;
  const { label: kcalLabel } = useRecipeCalorieRange(recipe);
  const nutritionColor = useNutritionColor(proteinPerServing, caloriesPerServing);
  const hasNutrition = caloriesPerServing != null && proteinPerServing != null;


  const cats =
    recipe.categories && recipe.categories.length > 0
      ? recipe.categories
      : recipe.category
        ? [recipe.category]
        : [];

  return (
    <Link
      to="/recipes/$id"
      params={{ id: recipe.id }}
      className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/40"
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        {imageUrl && !broken ? (
          <img
            src={imageUrl}
            alt={recipe.title}
            onError={() => setBroken(true)}
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground sm:text-base">
          {recipe.title}
        </h3>

        {cats.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {cats.slice(0, 3).map((c) => (
              <CategoryBadge key={c} name={c} className="px-1.5 py-0 text-[10px]" />
            ))}
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {totalTime > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {totalTime} min
            </span>
          )}
          {kcalLabel && (
            <span
              className="flex items-center gap-1 tabular-nums"
              style={{ color: hasNutrition ? nutritionColor : undefined }}
              title="pro Portion"
            >
              <Flame className="h-3 w-3" />
              {kcalLabel}
            </span>
          )}
          {recipe.tag && <span className="text-foreground/70">{recipe.tag}</span>}
        </div>
      </div>
    </Link>
  );
}
