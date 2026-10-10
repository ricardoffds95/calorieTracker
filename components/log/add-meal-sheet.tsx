"use client";

import { useState } from "react";
import { NutrientSummary } from "@/components/log/nutrient-summary";
import { PortionStepper } from "@/components/log/portion-stepper";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { mealEntryRow, type LogTarget } from "@/lib/log";
import type { SavedMeal } from "@/lib/queries/saved";

interface AddMealSheetProps {
  meal: SavedMeal;
  target: LogTarget;
  mealName: string;
  pending: boolean;
  onClose: () => void;
  onAdd: (meal: SavedMeal, doses: number) => void;
}

export function AddMealSheet({ meal, target, mealName, pending, onClose, onAdd }: AddMealSheetProps) {
  const [doses, setDoses] = useState(1);
  const row = mealEntryRow(target, meal, doses);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-lg pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>{meal.name}</SheetTitle>
          <SheetDescription>{meal.items.map((i) => i.name).join(", ")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <PortionStepper value={doses} onChange={setDoses} />
          <NutrientSummary value={row} />
        </div>
        <SheetFooter>
          <Button type="button" size="lg" className="h-11" disabled={pending} onClick={() => onAdd(meal, doses)}>
            {pending ? "A adicionar…" : `Adicionar a ${mealName.toLowerCase()}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
