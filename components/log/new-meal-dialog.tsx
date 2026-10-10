"use client";

import { useRef, useState } from "react";
import { Info, ListChecks } from "lucide-react";
import { AiPanel } from "@/components/log/ai-panel";
import { BarcodeScannerDialog } from "@/components/log/barcode-scanner-dialog";
import { FoodSearch } from "@/components/log/food-search";
import { PickSavedFoodsSheet } from "@/components/log/pick-saved-foods-sheet";
import { JoinFoodSheet } from "@/components/log/join-food-sheet";
import { ItemsEditor, fromEditable, toEditable, type EditableItem } from "@/components/log/items-editor";
import { MealActions } from "@/components/log/meal-actions";
import { PortionTotalsFields, portionItems, type PortionTotals } from "@/components/log/portion-totals-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FoodSearchResult, SavedFood } from "@/lib/food-search";
import type { LogTarget } from "@/lib/log";
import { parseDecimalInput } from "@/lib/numbers";
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

type Panel = "scan" | "ai" | "saved" | null;

export function NewMealDialog({ userId, initialTarget, now, foods, onClose, onAdded, onSaved }: NewMealDialogProps) {
  const [mode, setMode] = useState<"foods" | "portion">("foods");
  const [name, setName] = useState("");
  const [searching, setSearching] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [picked, setPicked] = useState<FoodSearchResult | null>(null); // a food waiting for its quantity
  const contentRef = useRef<HTMLDivElement>(null);
  const [searchKey, setSearchKey] = useState(0); // remounts the search to clear it after a pick
  const [rows, setRows] = useState<EditableItem[]>([]);
  const [totals, setTotals] = useState<PortionTotals>({ calories: "", protein_g: "0", carbs_g: "0", fat_g: "0" });

  const trimmed = name.trim();
  const items = mode === "foods" ? fromEditable(rows) : portionItems(trimmed, totals);

  // What is still needed before the meal can be saved, in words.
  const missing = (() => {
    const needs: string[] = [];
    if (!trimmed) needs.push("indicar o nome da refeição");
    if (mode === "foods") {
      if (rows.length === 0) needs.push("juntar pelo menos um alimento");
      else if (!items) return `${needs.length ? `Falta ${needs.join(" e ")}. ` : ""}Corrige os alimentos: cada um precisa de nome e de uma quantidade maior que 0.`;
    } else if (parseDecimalInput(totals.calories) === null) needs.push(needs.length ? "as calorias" : "indicar as calorias");
    else if (!items && trimmed) return "Os valores têm de ser números (0 ou mais).";
    return needs.length ? `Falta ${needs.join(" e ")} para poderes guardar.` : "";
  })();

  // A food from the search or the scanner asks its quantity first; the AI brings its own grams.
  function joinFood(food: FoodSearchResult, grams: number) {
    const item = { name: food.name, quantity_g: grams, ...scaleFromPer100g(food, grams) };
    setRows((r) => [...r, ...toEditable([item])]);
    setPicked(null);
    setSearchKey((k) => k + 1);
    contentRef.current?.scrollTo({ top: 0 });
  }

  function joinSaved(picked: SavedFood[]) {
    const items = picked.map((food) => ({ name: food.name, quantity_g: 100, ...scaleFromPer100g(food, 100) }));
    setRows((r) => [...r, ...toEditable(items)]);
    setPanel(null);
    contentRef.current?.scrollTo({ top: 0 });
  }

  function addAiItems(result: { name: string; kind: "food" | "meal"; items: FoodItem[] }, close: () => void) {
    setRows((r) => [...r, ...toEditable(result.items)]);
    if (result.kind === "meal") setName((current) => current || result.name); // a single food does not name the meal
    close();
    contentRef.current?.scrollTo({ top: 0 });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent ref={contentRef} className="max-h-[90dvh] max-w-sm overflow-y-auto">
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
              <Button type="button" variant="outline" className="h-11" disabled={foods.length === 0} onClick={() => setPanel("saved")}>
                <ListChecks aria-hidden />
                Escolher dos meus alimentos · {foods.length}
              </Button>
              <FoodSearch key={searchKey} saved={foods} onPick={(food) => setPicked(food)} onScan={() => setPanel("scan")} onAi={() => setPanel("ai")} onSearchingChange={setSearching} />
              {!searching &&
                (rows.length > 0 ? (
                  <ItemsEditor rows={rows} onChange={setRows} allowEmpty />
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
            <p role="status" className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{missing}</span>
            </p>
          )}
        </div>
      </DialogContent>
      <BarcodeScannerDialog open={panel === "scan"} onOpenChange={(open) => !open && setPanel((p) => (p === "scan" ? null : p))} onFound={(food) => setPicked(food)} />
      {panel === "saved" && <PickSavedFoodsSheet foods={foods} onJoin={joinSaved} onClose={() => setPanel(null)} />}
      {picked && <JoinFoodSheet food={picked} onJoin={(grams) => joinFood(picked, grams)} onClose={() => setPicked(null)} />}
      {panel === "ai" && (
        <AiPanel userId={userId} onClose={() => setPanel(null)} onUse={addAiItems} useLabels={{ food: "Juntar alimento", meal: "Usar refeição completa" }} />
      )}
    </Dialog>
  );
}
