"use client";

import { useState, type FormEvent } from "react";
import { DiaryTargetPicker } from "@/components/log/diary-target-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { foodEditSchema, type FoodEditValues } from "@/lib/diary-edit";
import { isValidTarget, savedFoodSchema, type LogTarget, type SavedFoodValues } from "@/lib/log";
import { parseDecimalInput } from "@/lib/numbers";

interface ManualEntryDialogProps {
  /** Day and meal the picker starts on. */
  initialTarget: LogTarget;
  pending: boolean;
  onClose: () => void;
  /** `saveAs`: the same food per 100 g, when "Guardar nos meus alimentos" is checked. */
  onAdd: (item: FoodEditValues, saveAs: SavedFoodValues | null, target: LogTarget) => void;
}

const asNumber = (text: string) => parseDecimalInput(text) ?? Number.NaN;
const FIELDS = [
  ["name", "Nome", false],
  ["quantity_g", "Quantidade (g)", true],
  ["calories", "Calorias (kcal)", true],
  ["protein_g", "Proteína (g)", true],
  ["carbs_g", "Hidratos (g)", true],
  ["fat_g", "Gordura (g)", true],
] as const;
type Field = (typeof FIELDS)[number][0];

export function ManualEntryDialog({ initialTarget, pending, onClose, onAdd }: ManualEntryDialogProps) {
  const [text, setText] = useState<Record<Field, string>>({ name: "", quantity_g: "100", calories: "", protein_g: "0", carbs_g: "0", fat_g: "0" });
  const [save, setSave] = useState(true);
  const [target, setTarget] = useState(initialTarget);
  const [touched, setTouched] = useState(false);

  const parsed = foodEditSchema.safeParse({
    name: text.name,
    quantity_g: asNumber(text.quantity_g),
    calories: asNumber(text.calories),
    protein_g: asNumber(text.protein_g),
    carbs_g: asNumber(text.carbs_g),
    fat_g: asNumber(text.fat_g),
  });
  const errors: Partial<Record<Field, string>> = {};
  if (!parsed.success) for (const issue of parsed.error.issues) errors[issue.path[0] as Field] ??= issue.message;

  const per100 = parsed.success
    ? savedFoodSchema.safeParse({
        name: parsed.data.name,
        calories_100g: (parsed.data.calories / parsed.data.quantity_g) * 100,
        protein_100g: (parsed.data.protein_g / parsed.data.quantity_g) * 100,
        carbs_100g: (parsed.data.carbs_g / parsed.data.quantity_g) * 100,
        fat_100g: (parsed.data.fat_g / parsed.data.quantity_g) * 100,
      })
    : null;
  const saveError = save && per100 && !per100.success ? "Estes valores dão mais do que é possível por 100 g. Confirma a quantidade." : null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!parsed.success || saveError || !isValidTarget(target)) return;
    onAdd(parsed.data, save && per100?.success ? per100.data : null, target);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Inserir manualmente</DialogTitle>
          <DialogDescription>Valores para a quantidade indicada.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-3">
          {FIELDS.map(([key, label, numeric]) => (
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
            Guardar nos meus alimentos
          </label>
          {touched && saveError && (
            <p role="alert" className="col-span-2 text-xs text-destructive">
              {saveError}
            </p>
          )}
          <div className="col-span-2">
            <DiaryTargetPicker value={target} onChange={setTarget} />
          </div>
          <DialogFooter className="col-span-2 gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "A adicionar…" : "Adicionar ao diário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
