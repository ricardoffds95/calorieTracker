"use client";

import { useState, type FormEvent } from "react";
import { NutrientSummary } from "@/components/log/nutrient-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { FoodSearchResult } from "@/lib/food-search";
import { quantitySchema, servingPresets } from "@/lib/log";
import { scaleFromPer100g } from "@/lib/nutrition";
import { formatNumberInput, parseDecimalInput } from "@/lib/numbers";

interface AddFoodSheetProps {
  food: FoodSearchResult;
  mealName: string;
  pending: boolean;
  onClose: () => void;
  onAdd: (food: FoodSearchResult, quantity_g: number) => void;
  /** Save the food in "Guardados" without logging it (only offered for foods that are not saved yet). */
  onSaveOnly: (food: FoodSearchResult) => void;
}

export function AddFoodSheet({ food, mealName, pending, onClose, onAdd, onSaveOnly }: AddFoodSheetProps) {
  const isNew = food.source !== "saved";
  const presets = servingPresets(food.serving_size);
  const [quantity, setQuantity] = useState(formatNumberInput(presets[1]?.grams ?? 100));
  const parsed = quantitySchema.safeParse(parseDecimalInput(quantity) ?? Number.NaN);
  const error = parsed.success ? null : parsed.error.issues[0]?.message;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (parsed.success) onAdd(food, parsed.data);
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-lg pb-[env(safe-area-inset-bottom)]">
        <form onSubmit={onSubmit} noValidate>
          <SheetHeader>
            <SheetTitle>{food.name}</SheetTitle>
            <SheetDescription>
              {food.brand ? `${food.brand} · ` : ""}
              {food.calories_100g} kcal por 100 g
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-quantity">Quantidade (g)</Label>
              <Input
                id="add-quantity"
                inputMode="decimal"
                className="h-11 text-base tabular-nums"
                value={quantity}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "add-quantity-error" : undefined}
                onChange={(e) => setQuantity(e.target.value)}
              />
              {error && (
                <p id="add-quantity-error" role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                {presets.map((p) => (
                  <Button key={p.label} type="button" variant="outline" className="h-9" onClick={() => setQuantity(formatNumberInput(p.grams))}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            {parsed.success && <NutrientSummary value={scaleFromPer100g(food, parsed.data)} />}
          </div>
          <SheetFooter>
            <Button type="submit" size="lg" className="h-11" disabled={!parsed.success || pending}>
              {pending ? "A adicionar…" : `${isNew ? "Guardar e adicionar" : "Adicionar"} a ${mealName.toLowerCase()}`}
            </Button>
            {isNew && (
              <Button type="button" variant="outline" size="lg" className="h-11" disabled={pending} onClick={() => onSaveOnly(food)}>
                Só guardar nos alimentos
              </Button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
