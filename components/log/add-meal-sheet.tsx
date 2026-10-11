"use client";

import { useState } from "react";
import { DiaryTargetPicker } from "@/components/log/diary-target-picker";
import { NutrientSummary } from "@/components/log/nutrient-summary";
import { PortionStepper } from "@/components/log/portion-stepper";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { isValidTarget, mealEntryRow, type LogTarget } from "@/lib/log";
import type { SavedMeal } from "@/lib/queries/saved";

interface AddMealSheetProps {
  meal: SavedMeal;
  /** Day and meal the picker starts on. */
  initialTarget: LogTarget;
  pending: boolean;
  onClose: () => void;
  onAdd: (meal: SavedMeal, doses: number, target: LogTarget) => void;
}

export function AddMealSheet({ meal, initialTarget, pending, onClose, onAdd }: AddMealSheetProps) {
  const [doses, setDoses] = useState(1);
  const [target, setTarget] = useState(initialTarget);
  const row = mealEntryRow(target, meal, doses);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{meal.name}</SheetTitle>
          <SheetDescription>{meal.items.map((i) => i.name).join(", ")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4">
          <PortionStepper value={doses} onChange={setDoses} />
          <NutrientSummary value={row} />
          <DiaryTargetPicker value={target} onChange={setTarget} />
        </div>
        <SheetFooter>
          <Button type="button" size="lg" className="h-11" disabled={pending || !isValidTarget(target)} onClick={() => onAdd(meal, doses, target)}>
            {pending ? "Adding…" : "Add to diary"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
