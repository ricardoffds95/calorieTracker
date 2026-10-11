"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollList } from "@/components/ui/scroll-list";
import { Skeleton } from "@/components/ui/skeleton";
import type { SavedFood } from "@/lib/food-search";
import type { SavedMeal } from "@/lib/queries/saved";
import { cn } from "@/lib/utils";

const PAGE = 15;

interface SavedListProps {
  foods: readonly SavedFood[] | undefined;
  meals: readonly SavedMeal[] | undefined;
  onPickFood: (food: SavedFood) => void;
  onPickMeal: (meal: SavedMeal) => void;
  onEditFood: (food: SavedFood) => void;
  onEditMeal: (meal: SavedMeal) => void;
}

type Entry = { kind: "food"; item: SavedFood } | { kind: "meal"; item: SavedMeal };

/** The user's saved foods and meals together, the most used first (the list shown before searching). */
export function SavedList({ foods, meals, onPickFood, onPickMeal, onEditFood, onEditMeal }: SavedListProps) {
  const [limit, setLimit] = useState(PAGE);
  const entries = useMemo<Entry[] | null>(() => {
    if (!foods || !meals) return null;
    const all: Entry[] = [...foods.map((item) => ({ kind: "food" as const, item })), ...meals.map((item) => ({ kind: "meal" as const, item }))];
    return all.sort((a, b) => b.item.times_used - a.item.times_used || a.item.name.localeCompare(b.item.name, "pt"));
  }, [foods, meals]);

  return (
    <section aria-label="Saved" className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">Saved</h2>
      {!entries && <Skeleton className="h-32 w-full" aria-label="Loading saved" />}
      {entries && entries.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">Nothing saved yet</p>
      )}
      {entries && entries.length > 0 && (
        <ScrollList aria-label="Saved list">
          <ul data-testid="saved-all">
            {entries.slice(0, limit).map((entry) =>
              entry.kind === "food" ? (
                <SavedRow
                  key={`f-${entry.item.id}`}
                  name={entry.item.name}
                  detail={`${entry.item.calories_100g} kcal/100 g`}
                  onPick={() => onPickFood(entry.item)}
                  onEdit={() => onEditFood(entry.item)}
                />
              ) : (
                <SavedRow
                  key={`m-${entry.item.id}`}
                  name={entry.item.name}
                  detail={`${entry.item.total_calories} kcal`}
                  tag="Meal"
                  onPick={() => onPickMeal(entry.item)}
                  onEdit={() => onEditMeal(entry.item)}
                />
              ),
            )}
          </ul>
        </ScrollList>
      )}
      {entries && entries.length > limit && (
        <Button type="button" variant="ghost" className="h-11" onClick={() => setLimit((n) => n + PAGE)}>
          Show more
        </Button>
      )}
      <Link href="/saved" className={cn(buttonVariants({ variant: "link" }), "h-11 self-start px-1 text-muted-foreground")}>
        Manage saved
      </Link>
    </section>
  );
}

function SavedRow({ name, detail, tag, onPick, onEdit }: { name: string; detail: string; tag?: string; onPick: () => void; onEdit: () => void }) {
  return (
    <li className="flex items-center gap-1">
      <button type="button" aria-label={`Choose ${name}`} onClick={onPick} className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-sm px-1 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{name}</span>
          {tag && <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{tag}</span>}
        </span>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{detail}</span>
      </button>
      <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" aria-label={`Edit saved ${name}`} onClick={onEdit}>
        <Pencil aria-hidden />
      </Button>
    </li>
  );
}
