"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollList } from "@/components/ui/scroll-list";
import { Skeleton } from "@/components/ui/skeleton";
import type { SavedFood } from "@/lib/food-search";
import type { SavedMeal } from "@/lib/queries/saved";
import { cn } from "@/lib/utils";

const PAGE = 15;

interface SavedListProps {
  kind: "foods" | "meals";
  foods: readonly SavedFood[] | undefined;
  meals: readonly SavedMeal[] | undefined;
  onPickFood: (food: SavedFood) => void;
  onPickMeal: (meal: SavedMeal) => void;
  onEditFood: (food: SavedFood) => void;
  onEditMeal: (meal: SavedMeal) => void;
  onNewMeal: () => void;
}

export function SavedList({ kind: tab, foods, meals, onPickFood, onPickMeal, onEditFood, onEditMeal, onNewMeal }: SavedListProps) {
  const [limit, setLimit] = useState(PAGE);
  const list = tab === "foods" ? foods : meals;

  return (
    <section aria-label="Guardados" className="flex flex-col gap-2">
      {tab === "meals" && (
        <Button type="button" variant="outline" className="h-11" onClick={onNewMeal}>
          <Plus aria-hidden />
          Nova refeição
        </Button>
      )}
      {!list && <Skeleton className="h-32 w-full" aria-label="A carregar guardados" />}
      {list && list.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">
          {tab === "foods"
            ? "Ainda sem alimentos guardados. Os que adicionares pela pesquisa ficam aqui."
            : "Ainda sem refeições guardadas. Cria uma acima ou a partir do registo com IA."}
        </p>
      )}
      {list && list.length > 0 && (
        <ScrollList aria-label="Lista de guardados">
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
        </ScrollList>
      )}
      {list && list.length > limit && (
        <Button type="button" variant="ghost" className="h-11" onClick={() => setLimit((n) => n + PAGE)}>
          Ver mais
        </Button>
      )}
      <Link href="/guardados" className={cn(buttonVariants({ variant: "link" }), "h-11 self-start px-1 text-muted-foreground")}>
        Gerir alimentos e refeições
      </Link>
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
