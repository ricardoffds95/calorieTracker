"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DiaryEntry } from "@/lib/diary";
import { foodEditSchema, mealEditSchema, rescaleEntry, toEntryUpdate, withLinkOverride, type EntryUpdate } from "@/lib/diary-edit";
import { formatNumberInput, parseDecimalInput } from "@/lib/numbers";

interface EditEntryDialogProps {
  entry: DiaryEntry;
  onClose: () => void;
  onSave: (id: string, update: EntryUpdate) => void;
}

const asNumber = (text: string) => parseDecimalInput(text) ?? Number.NaN;

export function EditEntryDialog({ entry, onClose, onSave }: EditEntryDialogProps) {
  const isFood = entry.kind === "food";
  const [name, setName] = useState(entry.name);
  const [quantity, setQuantity] = useState(entry.quantity_g === null ? "" : formatNumberInput(entry.quantity_g));
  const [calories, setCalories] = useState(formatNumberInput(entry.calories));
  const [protein, setProtein] = useState(formatNumberInput(entry.protein_g));
  const [carbs, setCarbs] = useState(formatNumberInput(entry.carbs_g));
  const [fat, setFat] = useState(formatNumberInput(entry.fat_g));

  const values = {
    name,
    quantity_g: asNumber(quantity),
    calories: asNumber(calories),
    protein_g: asNumber(protein),
    carbs_g: asNumber(carbs),
    fat_g: asNumber(fat),
  };
  const parsed = isFood ? foodEditSchema.safeParse(values) : mealEditSchema.safeParse(values);
  const errors: Record<string, string> = {};
  if (!parsed.success) for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;

  /** Changing the quantity rescales the nutrients from the original entry (no drift). */
  function onQuantityChange(text: string) {
    setQuantity(text);
    const amount = parseDecimalInput(text);
    const scaled = amount === null ? null : rescaleEntry(entry, amount);
    if (!scaled) return;
    setCalories(formatNumberInput(scaled.calories));
    setProtein(formatNumberInput(scaled.protein_g));
    setCarbs(formatNumberInput(scaled.carbs_g));
    setFat(formatNumberInput(scaled.fat_g));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!parsed.success) return;
    onSave(entry.id, withLinkOverride(entry, toEntryUpdate(entry.kind, parsed.data)));
    onClose();
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, key: string, numeric = true) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`edit-${id}`}>{label}</Label>
      <Input
        id={`edit-${id}`}
        value={value}
        onChange={(e) => set(e.target.value)}
        inputMode={numeric ? "decimal" : "text"}
        aria-invalid={errors[key] ? true : undefined}
        className="h-11"
      />
      {errors[key] && (
        <p role="alert" className="text-xs text-destructive">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar {isFood ? "alimento" : "refeição"}</DialogTitle>
          <DialogDescription>
            {isFood ? "Ao mudar a quantidade, os valores nutricionais ajustam-se." : "Os totais da refeição."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {field("name", "Nome", name, setName, "name", false)}
          {isFood && field("quantity", "Quantidade (g)", quantity, onQuantityChange, "quantity_g")}
          {field("calories", "Calorias (kcal)", calories, setCalories, "calories")}
          <div className="grid grid-cols-3 gap-3">
            {field("protein", "Proteína (g)", protein, setProtein, "protein_g")}
            {field("carbs", "Hidratos (g)", carbs, setCarbs, "carbs_g")}
            {field("fat", "Gordura (g)", fat, setFat, "fat_g")}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={!parsed.success}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
