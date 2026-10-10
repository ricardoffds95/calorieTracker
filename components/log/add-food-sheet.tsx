"use client";

import { useState } from "react";
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
  /** Day and meal the picker starts on. */
  initialTarget: LogTarget;
  pending: boolean;
  onClose: () => void;
  /** `save`: also keep the food in "Guardados" (always true for a food that is already saved). */
  onAdd: (food: FoodSearchResult, quantity_g: number, target: LogTarget, save: boolean) => void;
  /** Save the food in "Guardados" without logging it (only offered for foods that are not saved yet). */
  onSaveOnly?: (food: FoodSearchResult) => void;
}

export function AddFoodSheet({ food, initialTarget, pending, onClose, onAdd, onSaveOnly }: AddFoodSheetProps) {
  const isNew = food.source !== "saved" && onSaveOnly !== undefined;
  const presets = servingPresets(food.serving_size);
  const [grams, setGrams] = useState(presets[1]?.grams ?? 100);
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
            {food.calories_100g} kcal por 100 g
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4">
          <QuantityControl grams={grams} onChange={setGrams} presets={presets} />
          {parsed.success && <NutrientSummary value={scaleFromPer100g(food, parsed.data)} />}
          <DiaryTargetPicker value={target} onChange={setTarget} />
        </div>
        <SheetFooter>
          <Button type="button" size="lg" className="h-11" disabled={!ready || pending} onClick={() => parsed.success && onAdd(food, parsed.data, target, true)}>
            {pending ? "A adicionar…" : isNew ? "Guardar e adicionar ao diário" : "Adicionar ao diário"}
          </Button>
          {isNew && (
            <>
              <Button type="button" variant="outline" size="lg" className="h-11" disabled={!ready || pending} onClick={() => parsed.success && onAdd(food, parsed.data, target, false)}>
                Só adicionar ao diário
              </Button>
              <Button type="button" variant="outline" size="lg" className="h-11" disabled={pending} onClick={() => onSaveOnly(food)}>
                Só guardar nos alimentos
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
