"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SavedFood } from "@/lib/food-search";
import type { SavedMeal } from "@/lib/queries/saved";

const PAGE = 15;

interface SavedListProps {
  foods: readonly SavedFood[] | undefined;
  meals: readonly SavedMeal[] | undefined;
  onPickFood: (food: SavedFood) => void;
  onPickMeal: (meal: SavedMeal) => void;
  onEditFood: (food: SavedFood) => void;
  onEditMeal: (meal: SavedMeal) => void;
}

export function SavedList({ foods, meals, onPickFood, onPickMeal, onEditFood, onEditMeal }: SavedListProps) {
  const [tab, setTab] = useState<"foods" | "meals">("foods");
  const [limit, setLimit] = useState(PAGE);
  const list = tab === "foods" ? foods : meals;

  const switchTab = (next: "foods" | "meals") => {
    setTab(next);
    setLimit(PAGE);
  };

  return (
    <section aria-label="Guardados" className="flex flex-col gap-2">
      <div role="group" aria-label="Tipo de guardado" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {(["foods", "meals"] as const).map((t) => (
          <Button
            key={t}
            type="button"
            variant={tab === t ? "secondary" : "ghost"}
            aria-pressed={tab === t}
            className="h-9 bg-transparent text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground dark:aria-pressed:bg-background"
            onClick={() => switchTab(t)}
          >
            {t === "foods" ? "Alimentos" : "Refeições"}
          </Button>
        ))}
      </div>

      {!list && <Skeleton className="h-32 w-full" aria-label="A carregar guardados" />}
      {list && list.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">
          {tab === "foods"
            ? "Ainda sem alimentos guardados. Os que adicionares pela pesquisa ficam aqui."
            : "Ainda sem refeições guardadas. Cria uma a partir do registo com IA."}
        </p>
      )}
      {list && list.length > 0 && (
        <ul data-testid={`saved-${tab}`}>
          {tab === "foods"
            ? (list as SavedFood[]).slice(0, limit).map((food) => (
                <SavedRow
                  key={food.id}
                  name={food.name}
                  detail={`${food.calories_100g} kcal/100 g`}
                  onPick={() => onPickFood(food)}
                  onEdit={() => onEditFood(food)}
                />
              ))
            : (list as SavedMeal[]).slice(0, limit).map((meal) => (
                <SavedRow
                  key={meal.id}
                  name={meal.name}
                  detail={`${meal.total_calories} kcal`}
                  onPick={() => onPickMeal(meal)}
                  onEdit={() => onEditMeal(meal)}
                />
              ))}
        </ul>
      )}
      {list && list.length > limit && (
        <Button type="button" variant="ghost" className="h-11" onClick={() => setLimit((n) => n + PAGE)}>
          Ver mais
        </Button>
      )}
    </section>
  );
}

function SavedRow({ name, detail, onPick, onEdit }: { name: string; detail: string; onPick: () => void; onEdit: () => void }) {
  return (
    <li className="flex items-center gap-1">
      <button type="button" aria-label={`Escolher ${name}`} onClick={onPick} className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-sm px-1 text-left">
        <span className="min-w-0 truncate">{name}</span>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{detail}</span>
      </button>
      <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" aria-label={`Editar guardado ${name}`} onClick={onEdit}>
        <Pencil aria-hidden />
      </Button>
    </li>
  );
}
