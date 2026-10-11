import { Bookmark } from "lucide-react";
import type { FoodSearchResult } from "@/lib/food-search";

export function FoodResultRow({ food, onPick }: { food: FoodSearchResult; onPick: (food: FoodSearchResult) => void }) {
  return (
    <li>
      <button
        type="button"
        aria-label={`Choose ${food.name}`}
        onClick={() => onPick(food)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm px-1 py-1.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          {food.source === "saved" && <Bookmark aria-label="Saved" className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="min-w-0">
            <span className="block truncate">{food.name}</span>
            {food.brand && <span className="block truncate text-xs text-muted-foreground">{food.brand}</span>}
          </span>
        </span>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{food.calories_100g} kcal/100 g</span>
      </button>
    </li>
  );
}

/** A saved meal among the search results: the same row, tagged "Meal". */
export function MealResultRow({ meal, onPick }: { meal: { name: string; total_calories: number }; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-label={`Choose ${meal.name}`}
        onClick={onPick}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm px-1 py-1.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{meal.name}</span>
          <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Meal</span>
        </span>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{meal.total_calories} kcal</span>
      </button>
    </li>
  );
}
