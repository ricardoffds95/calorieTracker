"use client";

import { useState } from "react";
import { NutrientSummary } from "@/components/log/nutrient-summary";
import { QuantityControl } from "@/components/log/quantity-control";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { FoodSearchResult } from "@/lib/food-search";
import { quantitySchema, servingPresets } from "@/lib/log";
import { scaleFromPer100g } from "@/lib/nutrition";

const DEFAULT_GRAMS = 100;

/** Asks the quantity of a food (search, scan) that is joining a new meal. */
export function JoinFoodSheet({ food, onJoin, onClose }: { food: FoodSearchResult; onJoin: (grams: number) => void; onClose: () => void }) {
  const [grams, setGrams] = useState(DEFAULT_GRAMS);
  const parsed = quantitySchema.safeParse(grams);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{food.name}</SheetTitle>
          <SheetDescription>
            {food.brand ? `${food.brand} · ` : ""}
            {food.calories_100g} kcal por 100 g
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4">
          <QuantityControl grams={grams} onChange={setGrams} presets={servingPresets(food.serving_size)} />
          {parsed.success && <NutrientSummary value={scaleFromPer100g(food, parsed.data)} />}
        </div>
        <SheetFooter>
          <Button type="button" size="lg" className="h-11" disabled={!parsed.success} onClick={() => parsed.success && onJoin(parsed.data)}>
            Juntar à refeição
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
