"use client";

import { useState, type FormEvent } from "react";
import { DiaryTargetPicker } from "@/components/log/diary-target-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { portionItems } from "@/components/log/portion-totals-fields";
import { foodEditSchema, mealEditSchema, type FoodEditValues } from "@/lib/diary-edit";
import { isValidTarget, savedFoodSchema, type LogTarget, type SavedFoodValues } from "@/lib/log";
import type { FoodItem } from "@/lib/nutrition";
import { parseDecimalInput } from "@/lib/numbers";
import { cn } from "@/lib/utils";

/** What the dialog hands over: a food in grams, or a whole meal (the values of one portion). */
export type ManualEntry =
  | { kind: "food"; item: FoodEditValues; /** The same food per 100 g, when "Save to my foods" is checked. */ saveAs: SavedFoodValues | null }
  | { kind: "meal"; name: string; items: FoodItem[]; /** "Save to my meals" is checked. */ save: boolean };

interface ManualEntryDialogProps {
  /** Day and meal the picker starts on. */
  initialTarget: LogTarget;
  pending: boolean;
  onClose: () => void;
  onAdd: (entry: ManualEntry, target: LogTarget) => void;
  /** A problem the caller found (e.g. the meal name is already saved), shown under the checkbox. */
  error?: string | null;
}

const asNumber = (text: string) => parseDecimalInput(text) ?? Number.NaN;
const FIELDS = [
  ["name", "Name", false],
  ["quantity_g", "Amount (g)", true],
  ["calories", "Calories (kcal)", true],
  ["protein_g", "Protein (g)", true],
  ["carbs_g", "Carbs (g)", true],
  ["fat_g", "Fat (g)", true],
] as const;
type Field = (typeof FIELDS)[number][0];

export function ManualEntryDialog({ initialTarget, pending, onClose, onAdd, error = null }: ManualEntryDialogProps) {
  const [kind, setKind] = useState<"food" | "meal">("food");
  const [text, setText] = useState<Record<Field, string>>({ name: "", quantity_g: "100", calories: "", protein_g: "0", carbs_g: "0", fat_g: "0" });
  const [save, setSave] = useState(true);
  const [target, setTarget] = useState(initialTarget);
  const [touched, setTouched] = useState(false);

  const numbers = {
    name: text.name,
    calories: asNumber(text.calories),
    protein_g: asNumber(text.protein_g),
    carbs_g: asNumber(text.carbs_g),
    fat_g: asNumber(text.fat_g),
  };
  const isFood = kind === "food";
  const food = foodEditSchema.safeParse({ ...numbers, quantity_g: asNumber(text.quantity_g) });
  const meal = mealEditSchema.safeParse(numbers);
  const parsed = isFood ? food : meal;
  const errors: Partial<Record<Field, string>> = {};
  if (!parsed.success) for (const issue of parsed.error.issues) errors[issue.path[0] as Field] ??= issue.message;

  // A saved food is stored per 100 g: only a food can be too much for that.
  const per100 = isFood && food.success
    ? savedFoodSchema.safeParse({
        name: food.data.name,
        calories_100g: (food.data.calories / food.data.quantity_g) * 100,
        protein_100g: (food.data.protein_g / food.data.quantity_g) * 100,
        carbs_100g: (food.data.carbs_g / food.data.quantity_g) * 100,
        fat_100g: (food.data.fat_g / food.data.quantity_g) * 100,
      })
    : null;
  const saveError = isFood && save && per100 && !per100.success ? "Too much for 100 g" : null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!parsed.success || saveError || !isValidTarget(target)) return;
    if (isFood) {
      if (food.success) onAdd({ kind: "food", item: food.data, saveAs: save && per100?.success ? per100.data : null }, target);
      return;
    }
    if (!meal.success) return;
    const items = portionItems(meal.data.name, {
      calories: text.calories,
      protein_g: text.protein_g,
      carbs_g: text.carbs_g,
      fat_g: text.fat_g,
    });
    if (items) onAdd({ kind: "meal", name: meal.data.name, items, save }, target);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add manually</DialogTitle>
          <DialogDescription>{isFood ? "For this amount" : "Per portion"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-3">
          <div role="radiogroup" aria-label="Type" className="col-span-2 grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            {(["food", "meal"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn("h-9 rounded-sm text-sm font-medium", kind === k ? "bg-card text-foreground dark:bg-background" : "text-muted-foreground")}
              >
                {k === "food" ? "Food" : "Meal"}
              </button>
            ))}
          </div>
          {FIELDS.filter(([key]) => isFood || key !== "quantity_g").map(([key, label, numeric]) => (
            <div key={key} className={key === "name" ? "col-span-2 flex flex-col gap-1.5" : "flex flex-col gap-1.5"}>
              <Label htmlFor={`manual-${key}`}>{label}</Label>
              <Input
                id={`manual-${key}`}
                inputMode={numeric ? "decimal" : "text"}
                className="h-11"
                value={text[key]}
                aria-invalid={touched && errors[key] ? true : undefined}
                onChange={(e) => setText((t) => ({ ...t, [key]: e.target.value }))}
              />
              {touched && errors[key] && (
                <p role="alert" className="text-xs text-destructive">
                  {errors[key]}
                </p>
              )}
            </div>
          ))}
          <label className="col-span-2 flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-primary" checked={save} onChange={(e) => setSave(e.target.checked)} />
            {isFood ? "Save to my foods" : "Save to my meals"}
          </label>
          {touched && saveError && (
            <p role="alert" className="col-span-2 text-xs text-destructive">
              {saveError}
            </p>
          )}
          {error && (
            <p role="alert" className="col-span-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="col-span-2">
            <DiaryTargetPicker value={target} onChange={setTarget} />
          </div>
          <DialogFooter className="col-span-2 gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Adding…" : "Add to diary"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
