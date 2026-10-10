"use client";

import { useState } from "react";
import { AiPanel } from "@/components/log/ai-panel";
import { BarcodeScannerDialog } from "@/components/log/barcode-scanner-dialog";
import { FoodSearch } from "@/components/log/food-search";
import { ItemsEditor, fromEditable, toEditable, type EditableItem } from "@/components/log/items-editor";
import { MealActions } from "@/components/log/meal-actions";
import { PortionTotalsFields, portionItems, type PortionTotals } from "@/components/log/portion-totals-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FoodSearchResult, SavedFood } from "@/lib/food-search";
import type { LogTarget } from "@/lib/log";
import { scaleFromPer100g, type FoodItem } from "@/lib/nutrition";
import type { SavedMeal } from "@/lib/queries/saved";

interface NewMealDialogProps {
  userId: string;
  /** Without it (Guardados tab) the meal is only saved, not logged. */
  initialTarget?: LogTarget;
  now?: Date;
  foods: readonly SavedFood[];
  onClose: () => void;
  onAdded?: (message: string, day: string) => void;
  onSaved?: (meal: SavedMeal) => void;
}

const DEFAULT_GRAMS = 100;

type Panel = "scan" | "ai" | null;

export function NewMealDialog({ userId, initialTarget, now, foods, onClose, onAdded, onSaved }: NewMealDialogProps) {
  const [mode, setMode] = useState<"foods" | "portion">("foods");
  const [name, setName] = useState("");
  const [searching, setSearching] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [searchKey, setSearchKey] = useState(0); // remounts the search to clear it after a pick
  const [rows, setRows] = useState<EditableItem[]>([]);
  const [totals, setTotals] = useState<PortionTotals>({ calories: "", protein_g: "0", carbs_g: "0", fat_g: "0" });

  const trimmed = name.trim();
  const items = mode === "foods" ? fromEditable(rows) : portionItems(trimmed, totals);

  // A food from the search, the scanner or the AI joins with 100 g (changed in the list below).
  function addFood(food: FoodSearchResult) {
    const item = { name: food.name, quantity_g: DEFAULT_GRAMS, ...scaleFromPer100g(food, DEFAULT_GRAMS) };
    setRows((r) => [...r, ...toEditable([item])]);
    setPanel(null);
    setSearchKey((k) => k + 1);
  }

  function addAiItems(result: { name: string; items: FoodItem[] }, close: () => void) {
    setRows((r) => [...r, ...toEditable(result.items)]);
    setName((current) => current || result.name);
    close();
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
              <FoodSearch key={searchKey} saved={foods} onPick={addFood} onScan={() => setPanel("scan")} onAi={() => setPanel("ai")} onSearchingChange={setSearching} />
              {!searching &&
                (rows.length > 0 ? (
                  <ItemsEditor rows={rows} onChange={setRows} />
                ) : (
                  <p className="text-sm text-muted-foreground">Ainda sem alimentos. Procura acima, lê um código de barras ou usa a IA (100 g por omissão).</p>
                ))}
            </>
          ) : (
            <PortionTotalsFields value={totals} onChange={setTotals} />
          )}

          {searching ? null : items && trimmed ? (
            // Remount when the meal changes after being saved, so a stale saved copy is never reused.
            <MealActions
              key={JSON.stringify([trimmed, items])}
              userId={userId}
              initialTarget={initialTarget}
              now={now}
              name={trimmed}
              items={items}
              onAdded={onAdded}
              onSaved={onSaved}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Indica o nome e {mode === "foods" ? "pelo menos um alimento" : "as calorias"} para guardar.</p>
          )}
        </div>
      </DialogContent>
      <BarcodeScannerDialog open={panel === "scan"} onOpenChange={(open) => !open && setPanel((p) => (p === "scan" ? null : p))} onFound={addFood} />
      {panel === "ai" && (
        <AiPanel userId={userId} onClose={() => setPanel(null)} onUse={addAiItems} useLabel="Juntar à refeição" />
      )}
    </Dialog>
  );
}
