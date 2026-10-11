"use client";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEAL_TYPES } from "@/lib/macros";
import { isValidTarget, type LogTarget } from "@/lib/log";
import { mealLabel } from "@/lib/today";

interface DiaryTargetPickerProps {
  value: LogTarget;
  onChange: (value: LogTarget) => void;
}

/** Where an entry goes: the day and the meal. The meal is chosen here, not in a menu of the screen. */
export function DiaryTargetPicker({ value, onChange }: DiaryTargetPickerProps) {
  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Where to add">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="target-date">Date</Label>
        <Input id="target-date" type="date" className="block h-11 w-full min-w-0 max-w-full appearance-none" value={value.entry_date} onChange={(e) => onChange({ ...value, entry_date: e.target.value })} />
      </div>
      {!isValidTarget(value) && <Hint>Pick a date</Hint>}
      <div role="group" aria-label="Meal" className="grid grid-cols-4 gap-1">
        {MEAL_TYPES.map((meal) => (
          <Button
            key={meal}
            type="button"
            variant={meal === value.meal ? "default" : "outline"}
            aria-pressed={meal === value.meal}
            className="h-11 px-1 text-xs leading-tight whitespace-normal"
            onClick={() => onChange({ ...value, meal })}
          >
            {mealLabel(meal)}
          </Button>
        ))}
      </div>
    </div>
  );
}
