"use client";

import { useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { ScrollList } from "@/components/ui/scroll-list";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { filterSavedFoods, type SavedFood } from "@/lib/food-search";
import { cn } from "@/lib/utils";

interface PickSavedFoodsSheetProps {
  foods: readonly SavedFood[];
  onJoin: (foods: SavedFood[]) => void;
  onClose: () => void;
}

/** Every saved food in one list: tick several (the filter only narrows the list, ticks are kept) and join them to the meal at once. */
export function PickSavedFoodsSheet({ foods, onJoin, onClose }: PickSavedFoodsSheetProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const shown = query.trim() ? filterSavedFoods(foods, query) : foods;

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Os teus alimentos</SheetTitle>
          <SheetDescription>Marca os que fazem parte da refeição. Entram com 100 g, que ajustas depois.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4">
          {foods.length > 0 && (
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Filtrar alimentos"
                placeholder="Filtrar alimentos"
                autoComplete="off"
                enterKeyHint="search"
                className="h-11 pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          {foods.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda sem alimentos guardados. Os que adicionares pela pesquisa ficam aqui.</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alimento com esse nome.</p>
          ) : (
            <ScrollList aria-label="Alimentos guardados" className="max-h-[45dvh]">
              <ul className="flex flex-col">
                {shown.map((food) => {
                  const on = selected.has(food.id);
                  return (
                    <li key={food.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={food.name}
                        onClick={() => toggle(food.id)}
                        className="flex min-h-11 w-full items-center gap-3 rounded-sm px-1 py-1.5 text-left"
                      >
                        <span
                          aria-hidden
                          className={cn("flex size-5 shrink-0 items-center justify-center rounded-xs border border-input", on && "border-primary bg-primary text-primary-foreground")}
                        >
                          {on && <Check className="size-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{food.name}</span>
                          {food.brand && <span className="block truncate text-xs text-muted-foreground">{food.brand}</span>}
                        </span>
                        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{food.calories_100g} kcal/100 g</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollList>
          )}
        </div>
        <SheetFooter>
          {foods.length > 0 && selected.size === 0 && <Hint className="mx-0">Marca pelo menos um alimento para o juntar à refeição.</Hint>}
          <Button
            type="button"
            size="lg"
            className="h-11"
            disabled={selected.size === 0}
            // in the order of the list, not of the ticks
            onClick={() => onJoin(foods.filter((f) => selected.has(f.id)))}
          >
            {selected.size === 0 ? "Juntar à refeição" : `Juntar ${selected.size} ${selected.size === 1 ? "alimento" : "alimentos"}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
