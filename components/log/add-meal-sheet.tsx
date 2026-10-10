"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { NutrientSummary } from "@/components/log/nutrient-summary";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DOSE_STEP, MAX_DOSES, mealEntryRow, type LogTarget } from "@/lib/log";
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
  const change = (delta: number) => setDoses((d) => Math.min(MAX_DOSES, Math.max(DOSE_STEP, d + delta)));

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-lg pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>{meal.name}</SheetTitle>
          <SheetDescription>{meal.items.map((i) => i.name).join(", ")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Menos doses" disabled={doses <= DOSE_STEP} onClick={() => change(-DOSE_STEP)}>
              <Minus aria-hidden />
            </Button>
            <output aria-label="Doses" aria-live="polite" className="min-w-16 text-center text-lg font-semibold tabular-nums">
              {doses}×
            </output>
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Mais doses" disabled={doses >= MAX_DOSES} onClick={() => change(DOSE_STEP)}>
              <Plus aria-hidden />
            </Button>
          </div>
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
