import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RecipeListItem } from "@/types/recipe";
import { favoritesQuery } from "@/lib/recipes";
import { nutritionPerServing } from "@/lib/componentNutrition";
import { useAuth } from "@/hooks/use-auth";
import type { SortOption } from "@/components/SortDropdown";

const VIEW_STORAGE_KEY = "recipes:viewMode";
const SORT_STORAGE_KEY = "recipes:sortBy";
const FAV_STORAGE_KEY = "recipes:favOnly";

export type ViewMode = "grid" | "list" | "vibrant";

function recipeCats(r: RecipeListItem): string[] {
  return r.categories && r.categories.length > 0
    ? r.categories
    : r.category
      ? [r.category]
      : [];
}

function caloriesPerServing(r: RecipeListItem): number | null {
  return nutritionPerServing(r).calories;
}


function totalTime(r: RecipeListItem): number {
  return (r.prep_time_minutes ?? 0) + (r.cook_time_minutes ?? 0);
}

function readLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

export function useRecipeFilters(recipes: RecipeListItem[]) {
  const { user } = useAuth();
  const { data: favIds = [] } = useQuery({
    ...favoritesQuery(user?.id ?? ""),
    enabled: !!user?.id,
  });

  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [favOnly, setFavOnly] = useState<boolean>(() => readLS(FAV_STORAGE_KEY, "false") === "true");
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const v = readLS(SORT_STORAGE_KEY, "newest");
    return (["newest", "oldest", "name_asc", "name_desc", "time_asc", "kcal_asc"].includes(v)
      ? v
      : "newest") as SortOption;
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const v = readLS(VIEW_STORAGE_KEY, "grid");
    return v === "list" || v === "vibrant" ? v : "grid";
  });

  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);
  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(SORT_STORAGE_KEY, sortBy);
  }, [sortBy]);
  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(FAV_STORAGE_KEY, favOnly ? "true" : "false");
  }, [favOnly]);

  const favSet = useMemo(() => new Set(favIds), [favIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = recipes.filter((r) => {
      const matchS =
        q === "" ||
        r.title.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q);
      const cats = recipeCats(r);
      const matchC =
        selectedCategories.length === 0 || selectedCategories.some((s) => cats.includes(s));
      const matchF = !favOnly || favSet.has(r.id);
      return matchS && matchC && matchF;
    });

    const sorted = [...arr];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        case "name_asc":
          return a.title.localeCompare(b.title, "de");
        case "name_desc":
          return b.title.localeCompare(a.title, "de");
        case "time_asc": {
          const ta = totalTime(a);
          const tb = totalTime(b);
          const na = ta === 0 ? Number.POSITIVE_INFINITY : ta;
          const nb = tb === 0 ? Number.POSITIVE_INFINITY : tb;
          return na - nb;
        }
        case "kcal_asc": {
          const ka = caloriesPerServing(a);
          const kb = caloriesPerServing(b);
          const na = ka ?? Number.POSITIVE_INFINITY;
          const nb = kb ?? Number.POSITIVE_INFINITY;
          return na - nb;
        }
        case "newest":
        default:
          return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      }
    });
    return sorted;
  }, [recipes, search, selectedCategories, favOnly, favSet, sortBy]);

  function toggleCategory(c: string) {
    setSelectedCategories((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  }

  return {
    search,
    setSearch,
    selectedCategories,
    setSelectedCategories,
    toggleCategory,
    favOnly,
    setFavOnly,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    filtered,
    favSet,
    hasFavorites: favIds.length > 0,
  };
}
