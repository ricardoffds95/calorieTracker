"use client";

import { useState } from "react";
import { ItemsEditor, fromEditable, toEditable, type EditableItem } from "@/components/log/items-editor";
import { PropagationChoice } from "@/components/log/propagation-choice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SavedFood } from "@/lib/food-search";
import { savedFoodSchema, savedMealSchema, type PropagationScope } from "@/lib/log";
import { parseDecimalInput } from "@/lib/numbers";
import { countLinkedEntries, useDeleteSaved, useUpdateSavedFood, useUpdateSavedMeal, type SavedMeal } from "@/lib/queries/saved";

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
  const [rows, setRows] = useState<EditableItem[]>(() => (isFood ? [] : toEditable((target.item as SavedMeal).items)));
  const [linked, setLinked] = useState<{ all: number; fromToday: number } | null>(null);
  const [step, setStep] = useState<"edit" | "propagate" | "delete">("edit");
  const [error, setError] = useState<string | null>(null);

  const updateFood = useUpdateSavedFood(userId);
  const updateMeal = useUpdateSavedMeal(userId);
  const remove = useDeleteSaved(userId);
  const pending = updateFood.isPending || updateMeal.isPending || remove.isPending;

  const food = isFood
    ? savedFoodSchema.safeParse({ name, ...Object.fromEntries(PER100.map(([k]) => [k, parseDecimalInput(per100[k] ?? "") ?? Number.NaN])) })
    : null;
  const meal = isFood ? null : savedMealSchema.safeParse({ name, items: fromEditable(rows) });
  const valid = isFood ? food!.success : meal!.success;

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
          <DialogDescription>{isFood ? "Valores por 100 g." : "Os totais são a soma dos itens."}</DialogDescription>
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
            ) : (
              <ItemsEditor rows={rows} onChange={setRows} />
            )}
            {!valid && (
              <p role="alert" className="text-xs text-destructive">
                {(isFood ? food?.error : meal?.error)?.issues[0]?.message ?? "Valores inválidos."}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" size="lg" className="text-destructive" onClick={() => setStep("delete")}>
                Apagar
              </Button>
              <Button type="button" size="lg" disabled={!valid || pending} onClick={onSave}>
                Guardar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "propagate" && linked && <PropagationChoice linked={linked} pending={pending} onChoose={save} onBack={() => setStep("edit")} />}

        {step === "delete" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Apagar <strong>{target.item.name}</strong> dos guardados? As entradas do diário mantêm-se como estão.
            </p>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep("edit")}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                disabled={pending}
                onClick={() => remove.mutate({ kind: target.kind, id: target.item.id }, { onSuccess: onClose })}
              >
                Apagar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
