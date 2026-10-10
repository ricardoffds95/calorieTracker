"use client";

import { useState } from "react";
import { ItemsEditor, fromEditable, toEditable, type EditableItem } from "@/components/log/items-editor";
import { PortionTotalsFields, portionItems, totalsFromItem, type PortionTotals } from "@/components/log/portion-totals-fields";
import { PropagationChoice } from "@/components/log/propagation-choice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SavedFood } from "@/lib/food-search";
import { savedFoodSchema, savedMealSchema, type PropagationScope } from "@/lib/log";
import { parseDecimalInput } from "@/lib/numbers";
import { countLinkedEntries, useUpdateSavedFood, useUpdateSavedMeal, type SavedMeal } from "@/lib/queries/saved";

export type SavedTarget = { kind: "food"; item: SavedFood } | { kind: "meal"; item: SavedMeal };

interface EditSavedDialogProps {
  userId: string;
  target: SavedTarget;
  todayKey: string;
  onClose: () => void;
}

const PER100 = [
  ["calories_100g", "Calorias"],
  ["protein_100g", "Proteína (g)"],
  ["carbs_100g", "Hidratos (g)"],
  ["fat_100g", "Gordura (g)"],
] as const;

export function EditSavedDialog({ userId, target, todayKey, onClose }: EditSavedDialogProps) {
  const isFood = target.kind === "food";
  const [name, setName] = useState(target.item.name);
  const [per100, setPer100] = useState(() =>
    isFood ? Object.fromEntries(PER100.map(([k]) => [k, String((target.item as SavedFood)[k])])) : {},
  );
  const mealItems = isFood ? [] : (target.item as SavedMeal).items;
  // A meal defined per portion (one item without grams) is edited through its totals.
  const isPortion = mealItems.length === 1 && mealItems[0]!.quantity_g === null;
  const [rows, setRows] = useState<EditableItem[]>(() => (isFood || isPortion ? [] : toEditable(mealItems)));
  const [totals, setTotals] = useState<PortionTotals | null>(() => (isPortion ? totalsFromItem(mealItems[0]!) : null));
  const [linked, setLinked] = useState<{ all: number; fromToday: number } | null>(null);
  const [step, setStep] = useState<"edit" | "propagate">("edit");
  const [error, setError] = useState<string | null>(null);

  const updateFood = useUpdateSavedFood(userId);
  const updateMeal = useUpdateSavedMeal(userId);
  const pending = updateFood.isPending || updateMeal.isPending;

  const food = isFood
    ? savedFoodSchema.safeParse({ name, ...Object.fromEntries(PER100.map(([k]) => [k, parseDecimalInput(per100[k] ?? "") ?? Number.NaN])) })
    : null;
  const meal = isFood ? null : savedMealSchema.safeParse({ name, items: totals ? portionItems(name, totals) : fromEditable(rows) });
  const valid = isFood ? food!.success : meal!.success;
  // zod's own wording is for developers: say it in words
  const problem = (() => {
    if (valid) return null;
    if (isFood) return food?.error?.issues[0]?.message ?? "Valores inválidos.";
    if (!name.trim()) return "Indica um nome.";
    if (totals) return parseDecimalInput(totals.calories) === null ? "Indica as calorias (um número)." : "Os valores têm de ser números (0 ou mais).";
    return rows.length === 0 ? "Falta juntar pelo menos um alimento." : "Corrige os alimentos: cada um precisa de nome e de uma quantidade maior que 0.";
  })();

  function save(scope: PropagationScope) {
    const options = { onSuccess: onClose };
    const base = { id: target.item.id, scope, todayKey };
    if (isFood && food?.success) updateFood.mutate({ ...base, values: food.data }, options);
    if (!isFood && meal?.success) updateMeal.mutate({ ...base, values: meal.data }, options);
  }

  async function onSave() {
    setError(null);
    try {
      const counts = await countLinkedEntries(target.kind, target.item.id, todayKey);
      if (counts.all === 0) return save("none");
      setLinked(counts);
      setStep("propagate");
    } catch {
      setError("Sem ligação. Verifica a internet e tenta novamente.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {isFood ? "alimento" : "refeição"} guardado</DialogTitle>
          <DialogDescription>{isFood ? "Valores por 100 g." : isPortion ? "Valores de 1 porção." : "1 porção é a soma dos itens."}</DialogDescription>
        </DialogHeader>

        {step === "edit" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="saved-name">Nome</Label>
              <Input id="saved-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {isFood ? (
              <div className="grid grid-cols-2 gap-3">
                {PER100.map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <Label htmlFor={`saved-${key}`}>{label}</Label>
                    <Input id={`saved-${key}`} inputMode="decimal" className="h-11" value={per100[key]} onChange={(e) => setPer100((v) => ({ ...v, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            ) : totals ? (
              <PortionTotalsFields value={totals} onChange={setTotals} />
            ) : (
              <ItemsEditor rows={rows} onChange={setRows} />
            )}
            {problem && (
              <p role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="lg" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" size="lg" disabled={!valid || pending} onClick={onSave}>
                Guardar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "propagate" && linked && <PropagationChoice linked={linked} pending={pending} onChoose={save} onBack={() => setStep("edit")} />}
      </DialogContent>
    </Dialog>
  );
}
