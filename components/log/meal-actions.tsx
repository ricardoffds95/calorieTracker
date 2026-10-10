"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { NutrientSummary } from "@/components/log/nutrient-summary";
import { PortionStepper } from "@/components/log/portion-stepper";
import { Button } from "@/components/ui/button";
import { mealEntryRow, type LogTarget } from "@/lib/log";
import { sumItems, type FoodItem } from "@/lib/nutrition";
import { useAddEntries } from "@/lib/queries/diary";
import { DUPLICATE_NAME, useCreateSavedMeal, type SavedMeal } from "@/lib/queries/saved";

interface MealActionsProps {
  userId: string;
  /** Where to log it. Without a target (Guardados tab) the meal can only be saved. */
  target?: LogTarget;
  /** Label of the diary meal (e.g. "Almoço"). */
  mealName?: string;
  name: string;
  items: FoodItem[];
  /** Called after something was added to the diary, with the toast text. */
  onAdded?: (message: string) => void;
  /** Called after the meal was saved (with or without logging it). */
  onSaved?: (meal: SavedMeal) => void;
  /** Shown as "Editar" when given (AI result). */
  onEdit?: () => void;
}

const DUPLICATE_MESSAGE = "Já tens uma refeição guardada com este nome. Muda o nome para a guardar.";

/** Save the meal, save and add it to the diary (in portions), edit it, or only add it. */
export function MealActions({ userId, target, mealName = "", name, items, onAdded, onSaved, onEdit }: MealActionsProps) {
  const [portions, setPortions] = useState(1);
  const [saved, setSaved] = useState<SavedMeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createMeal = useCreateSavedMeal(userId);
  const add = useAddEntries(userId);
  const pending = createMeal.isPending || add.isPending;
  const totals = sumItems(items);
  const where = mealName.toLowerCase();

  /** The saved meal (saving it now if needed), or null when it could not be saved. */
  async function ensureSaved(): Promise<SavedMeal | null> {
    if (saved) return saved;
    setError(null);
    try {
      const meal = await createMeal.mutateAsync({ name, items });
      setSaved(meal);
      onSaved?.(meal);
      return meal;
    } catch (e) {
      if ((e as { code?: string }).code === DUPLICATE_NAME) setError(DUPLICATE_MESSAGE);
      return null;
    }
  }

  async function addToDiary(meal: { id: string | null; name: string; items: FoodItem[] }) {
    if (!target) return;
    try {
      await add.mutateAsync({ rows: [mealEntryRow(target, meal, portions)] });
      onAdded?.(`${meal.name} adicionado a ${where}`);
    } catch {
      // the mutation already shows "Sem ligação…"
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <NutrientSummary
        value={{ calories: totals.total_calories, protein_g: totals.total_protein, carbs_g: totals.total_carbs, fat_g: totals.total_fat }}
      />
      <p className="-mt-2 text-xs text-muted-foreground">Valores de 1 porção</p>
      {target && <PortionStepper value={portions} onChange={setPortions} />}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {target && (
        <Button
          type="button"
          size="lg"
          className="h-11"
          disabled={pending}
          onClick={async () => {
            const meal = await ensureSaved();
            if (meal) await addToDiary(meal);
          }}
        >
          {saved ? `Adicionar a ${where}` : "Guardar e adicionar ao diário"}
        </Button>
      )}
      <div className={target ? "grid grid-cols-2 gap-2" : "flex flex-col"}>
        <Button
          type="button"
          size={target ? "default" : "lg"}
          variant={target ? "outline" : "default"}
          className="h-11"
          disabled={pending || saved !== null}
          onClick={ensureSaved}
        >
          {saved ? (
            <>
              <Check aria-hidden /> Guardada
            </>
          ) : (
            "Guardar nas refeições"
          )}
        </Button>
        {onEdit && (
          <Button type="button" variant="outline" className="h-11" disabled={pending || saved !== null} onClick={onEdit}>
            Editar
          </Button>
        )}
      </div>
      {target && !saved && (
        <Button type="button" variant="link" className="h-11 text-muted-foreground" disabled={pending} onClick={() => addToDiary({ id: null, name, items })}>
          Só adicionar ao diário (sem guardar)
        </Button>
      )}
    </div>
  );
}
