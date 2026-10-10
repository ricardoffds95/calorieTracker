"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ItemsEditor, fromEditable, toEditable, type EditableItem } from "@/components/log/items-editor";
import { MealActions } from "@/components/log/meal-actions";
import { PortionTotalsFields, portionItems, type PortionTotals } from "@/components/log/portion-totals-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchSavedFoods, type SavedFood } from "@/lib/food-search";
import type { LogTarget } from "@/lib/log";
import { scaleFromPer100g } from "@/lib/nutrition";

interface NewMealDialogProps {
  userId: string;
  target: LogTarget;
  mealName: string;
  foods: readonly SavedFood[];
  onClose: () => void;
  onAdded: (message: string) => void;
}

const DEFAULT_GRAMS = 100;

export function NewMealDialog({ userId, target, mealName, foods, onClose, onAdded }: NewMealDialogProps) {
  const [mode, setMode] = useState<"foods" | "portion">("foods");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<EditableItem[]>([]);
  const [totals, setTotals] = useState<PortionTotals>({ calories: "", protein_g: "0", carbs_g: "0", fat_g: "0" });

  const trimmed = name.trim();
  const items = mode === "foods" ? fromEditable(rows) : portionItems(trimmed, totals);
  const matches = query.trim() ? searchSavedFoods(foods, query).slice(0, 6) : [];

  function addFood(food: (typeof matches)[number]) {
    const item = { name: food.name, quantity_g: DEFAULT_GRAMS, ...scaleFromPer100g(food, DEFAULT_GRAMS) };
    setRows((r) => [...r, ...toEditable([item])]);
    setQuery("");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova refeição</DialogTitle>
          <DialogDescription>Uma porção é a soma dos alimentos, ou os valores que indicares.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div role="group" aria-label="Como criar" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            {(["foods", "portion"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant="ghost"
                aria-pressed={mode === m}
                className="h-9 text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground dark:aria-pressed:bg-background"
                onClick={() => setMode(m)}
              >
                {m === "foods" ? "Juntar alimentos" : "Valores por porção"}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-meal-name">Nome da refeição</Label>
            <Input id="new-meal-name" className="h-11" placeholder="ex: Frango com arroz" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {mode === "foods" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-meal-search">Adicionar alimento guardado</Label>
                <Input id="new-meal-search" className="h-11" placeholder="Procurar nos teus alimentos" value={query} onChange={(e) => setQuery(e.target.value)} />
                {matches.length > 0 && (
                  <ul className="flex flex-col">
                    {matches.map((food) => (
                      <li key={food.id}>
                        <button
                          type="button"
                          aria-label={`Juntar ${food.name}`}
                          onClick={() => addFood(food)}
                          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm px-1 text-left"
                        >
                          <span className="min-w-0 truncate">{food.name}</span>
                          <Plus aria-hidden className="size-4 shrink-0 text-primary" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {query.trim() && matches.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum alimento guardado com esse nome. Adiciona-o primeiro pela pesquisa.</p>
                )}
              </div>
              {rows.length > 0 ? (
                <ItemsEditor rows={rows} onChange={setRows} />
              ) : (
                <p className="text-sm text-muted-foreground">Ainda sem alimentos. Procura acima e toca para juntar (100 g por omissão).</p>
              )}
            </>
          ) : (
            <PortionTotalsFields value={totals} onChange={setTotals} />
          )}

          {items && trimmed ? (
            // Remount when the meal changes after being saved, so a stale saved copy is never reused.
            <MealActions key={JSON.stringify([trimmed, items])} userId={userId} target={target} mealName={mealName} name={trimmed} items={items} onAdded={onAdded} />
          ) : (
            <p className="text-xs text-muted-foreground">Indica o nome e {mode === "foods" ? "pelo menos um alimento" : "as calorias"} para guardar.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
