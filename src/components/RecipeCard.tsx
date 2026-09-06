import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clock, Flame } from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { getCategoryGradient } from "@/lib/categories";
import type { RecipeListItem } from "@/types/recipe";
import { useSignedImage } from "@/hooks/use-signed-image";
import { useNutritionColor } from "@/hooks/use-nutrition-color";
import { nutritionPerServing } from "@/lib/componentNutrition";
import { useRecipeCalorieRange } from "@/hooks/use-recipe-calorie-range";

export function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
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

  const gradient = getCategoryGradient(cats[0] ?? recipe.title ?? "");

  return (
    <Link
      to="/recipes/$id"
      params={{ id: recipe.id }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {imageUrl && !broken ? (
          <img
            src={imageUrl}
            alt={recipe.title}
            onError={() => setBroken(true)}
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundImage: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
          >
            <span
              className="text-4xl font-semibold tracking-tight"
              style={{ color: gradient.accent, opacity: 0.9 }}
            >
              {(recipe.title ?? "").trim().charAt(0).toUpperCase() || "?"}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground sm:text-base">
          {recipe.title?.trim() || "Ohne Titel"}
        </h3>

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
              <Clock className="h-3 w-3" />
              {totalTime} min
            </span>
          ) : (
            <span />
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

        </div>
      </div>
    </Link>
  );
}
