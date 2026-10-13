"use client";

import { useRef, useState } from "react";
import { ListChecks } from "lucide-react";
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
import { Hint } from "@/components/ui/hint";
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

  // What is still needed before the meal can be saved.
  const missing = (() => {
    const needs: string[] = [];
    if (!trimmed) needs.push("name");
    if (mode === "foods") {
      if (rows.length === 0) needs.push("a food");
      else if (!items) return "Each food needs a name and an amount above 0";
    } else if (parseDecimalInput(totals.calories) === null) needs.push("calories");
    else if (!items && trimmed) return "Invalid values";
    return needs.length ? `Missing: ${needs.join(", ")}` : "";
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
          <DialogTitle>New meal</DialogTitle>
          <DialogDescription>Portion = sum of foods</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div role="group" aria-label="Como criar" hidden={searching} className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            {(["foods", "portion"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant="ghost"
                aria-pressed={mode === m}
                className="h-9 text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground dark:aria-pressed:bg-background"
                onClick={() => setMode(m)}
              >
                {m === "foods" ? "Add foods" : "Per portion"}
              </Button>
            ))}
          </div>

          <div hidden={searching} className="flex flex-col gap-1.5">
            <Label htmlFor="new-meal-name">Meal name</Label>
            <Input id="new-meal-name" className="h-11" placeholder="e.g. Chicken and rice" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {mode === "foods" ? (
            <>
              <Button type="button" variant="outline" className="h-11" hidden={searching} disabled={foods.length === 0} onClick={() => setPanel("saved")}>
                <ListChecks aria-hidden />
                Pick from my foods · {foods.length}
              </Button>
              <FoodSearch key={searchKey} saved={foods} onPick={(food) => setPicked(food)} onScan={() => setPanel("scan")} onAi={() => setPanel("ai")} onSearchingChange={setSearching} compact />
              {!searching &&
                (rows.length > 0 ? (
                  <ItemsEditor rows={rows} onChange={setRows} allowEmpty />
                ) : (
                  <p className="text-sm text-muted-foreground">No foods yet</p>
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
            <Hint>{missing}</Hint>
          )}
        </div>
      </DialogContent>
      <BarcodeScannerDialog open={panel === "scan"} onOpenChange={(open) => !open && setPanel((p) => (p === "scan" ? null : p))} onFound={(food) => setPicked(food)} />
      {panel === "saved" && <PickSavedFoodsSheet foods={foods} onJoin={joinSaved} onClose={() => setPanel(null)} />}
      {picked && <JoinFoodSheet food={picked} onJoin={(grams) => joinFood(picked, grams)} onClose={() => setPicked(null)} />}
      {panel === "ai" && (
        <AiPanel userId={userId} onClose={() => setPanel(null)} onUse={addAiItems} useLabels={{ food: "Add food", meal: "Use whole meal" }} />
      )}
    </Dialog>
  );
}
