"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiaryTargetPicker } from "@/components/log/diary-target-picker";
import { NutrientSummary } from "@/components/log/nutrient-summary";
import { QuantityControl } from "@/components/log/quantity-control";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { FoodSearchResult } from "@/lib/food-search";
import { isValidTarget, quantitySchema, servingPresets, type LogTarget } from "@/lib/log";
import { scaleFromPer100g } from "@/lib/nutrition";

interface AddFoodSheetProps {
  food: FoodSearchResult;
  /** Grams the quantity starts on (the AI's estimate); otherwise the serving or 100 g. */
  initialGrams?: number;
  /** Day and meal the picker starts on. */
  initialTarget: LogTarget;
  pending: boolean;
  onClose: () => void;
  /** `save`: also keep the food in "Saved" (the star; always true for a food that is already saved). */
  onAdd: (food: FoodSearchResult, quantity_g: number, target: LogTarget, save: boolean) => void;
}

export function AddFoodSheet({ food, initialGrams, initialTarget, pending, onClose, onAdd }: AddFoodSheetProps) {
  const alreadySaved = food.source === "saved";
  const [star, setStar] = useState(false);
  const presets = servingPresets(food.serving_size);
  const [grams, setGrams] = useState(initialGrams ?? presets[1]?.grams ?? 100);
  const [target, setTarget] = useState(initialTarget);
  const parsed = quantitySchema.safeParse(grams);
  const ready = parsed.success && isValidTarget(target);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{food.name}</SheetTitle>
          <SheetDescription>
            {food.brand ? `${food.brand} · ` : ""}
            {food.calories_100g} kcal per 100 g
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4">
          <QuantityControl grams={grams} onChange={setGrams} presets={presets} />
          {parsed.success && <NutrientSummary value={scaleFromPer100g(food, parsed.data)} />}
          <DiaryTargetPicker value={target} onChange={setTarget} />
        </div>
        <SheetFooter>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn("size-12 shrink-0", (alreadySaved || star) && "border-primary bg-primary/10")}
              aria-pressed={alreadySaved || star}
              aria-label={alreadySaved ? "Saved" : "Save to favorites"}
              disabled={alreadySaved}
              onClick={() => setStar((value) => !value)}
            >
              <Star aria-hidden className={cn("size-7", alreadySaved || star ? "fill-primary text-primary" : "text-muted-foreground")} />
            </Button>
            <Button type="button" size="lg" className="h-12 flex-1" disabled={!ready || pending} onClick={() => parsed.success && onAdd(food, parsed.data, target, alreadySaved || star)}>
              {pending ? "Adding…" : "Add to diary"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
