"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savedFoodSchema } from "@/lib/log";
import { parseDecimalInput } from "@/lib/numbers";
import { DUPLICATE_NAME, useCreateSavedFood } from "@/lib/queries/saved";

const FIELDS = [
  ["calories_100g", "Calorias (kcal)"],
  ["protein_100g", "Proteína (g)"],
  ["carbs_100g", "Hidratos (g)"],
  ["fat_100g", "Gordura (g)"],
] as const;
type Field = (typeof FIELDS)[number][0];

/** A food typed by hand, values per 100 g (labels on packaging use the same unit). */
export function NewFoodDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [values, setValues] = useState<Record<Field, string>>({ calories_100g: "", protein_100g: "0", carbs_100g: "0", fat_100g: "0" });
  const [touched, setTouched] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const create = useCreateSavedFood(userId);

  const num = (text: string) => parseDecimalInput(text) ?? Number.NaN;
  const parsed = savedFoodSchema.safeParse({
    name,
    brand,
    calories_100g: num(values.calories_100g),
    protein_100g: num(values.protein_100g),
    carbs_100g: num(values.carbs_100g),
    fat_100g: num(values.fat_100g),
  });
  const message = parsed.success ? null : (parsed.error.issues[0]?.message ?? "Valores inválidos.");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setDuplicate(false);
    if (!parsed.success) return;
    create.mutate(parsed.data, {
      onSuccess: onClose,
      onError: (error: { code?: string }) => setDuplicate(error.code === DUPLICATE_NAME),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo alimento</DialogTitle>
          <DialogDescription>Valores por 100 g, como vêm no rótulo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-food-name">Nome</Label>
            <Input id="new-food-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-food-brand">Marca (opcional)</Label>
            <Input id="new-food-brand" className="h-11" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`new-food-${key}`}>{label}</Label>
                <Input
                  id={`new-food-${key}`}
                  inputMode="decimal"
                  className="h-11"
                  value={values[key]}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          {touched && message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          {duplicate && (
            <p role="alert" className="text-sm text-destructive">
              Já tens um alimento guardado com este nome.
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={create.isPending}>
              {create.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
