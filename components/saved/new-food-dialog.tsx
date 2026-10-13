"use client";

import { useRef, useState, type FormEvent } from "react";
import { AiPanel } from "@/components/log/ai-panel";
import { BarcodeScannerDialog } from "@/components/log/barcode-scanner-dialog";
import { DIALOG_LIST, FoodSearch } from "@/components/log/food-search";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FoodSearchResult, SavedFood } from "@/lib/food-search";
import { savedFoodSchema } from "@/lib/log";
import { per100gFromItems, type FoodItem } from "@/lib/nutrition";
import { parseDecimalInput } from "@/lib/numbers";
import { DUPLICATE_NAME, useCreateSavedFood } from "@/lib/queries/saved";

const FIELDS = [
  ["calories_100g", "Calories (kcal)"],
  ["protein_100g", "Protein (g)"],
  ["carbs_100g", "Carbs (g)"],
  ["fat_100g", "Fat (g)"],
] as const;
type Field = (typeof FIELDS)[number][0];

const NO_GRAMS = "No grams given. Add an amount";

/**
 * A food typed by hand, values per 100 g (labels on packaging use the same unit).
 * The search, the scanner and the AI only fill the form: nothing is saved until "Save".
 */
export function NewFoodDialog({ userId, foods, onClose }: { userId: string; foods: readonly SavedFood[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [values, setValues] = useState<Record<Field, string>>({ calories_100g: "", protein_100g: "0", carbs_100g: "0", fat_100g: "0" });
  const [searching, setSearching] = useState(false);
  const [panel, setPanel] = useState<"scan" | "ai" | null>(null);
  const [fillNote, setFillNote] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0); // remounts the search to clear it after a pick
  const contentRef = useRef<HTMLDivElement>(null);
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
  const message = parsed.success ? null : (parsed.error.issues[0]?.message ?? "Invalid values");

  function fill(next: { name: string; brand?: string; calories_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number }) {
    setName(next.name);
    setBrand(next.brand ?? "");
    setValues({
      calories_100g: String(next.calories_100g),
      protein_100g: String(next.protein_100g),
      carbs_100g: String(next.carbs_100g),
      fat_100g: String(next.fat_100g),
    });
    setFillNote(`Filled from ${next.name}`);
    contentRef.current?.scrollTo({ top: 0 });
    setDuplicate(false);
    setPanel(null);
    setSearchKey((k) => k + 1);
  }

  function fillFromAi(result: { name: string; kind: "food" | "meal"; items: FoodItem[] }, close: () => void) {
    const per100 = per100gFromItems(result.items);
    close();
    if (!per100) return setFillNote(NO_GRAMS);
    fill({ name: result.name, ...per100 });
  }

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
      <DialogContent ref={contentRef} className="max-h-[90dvh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New food</DialogTitle>
          <DialogDescription>Per 100 g</DialogDescription>
        </DialogHeader>
        <FoodSearch key={searchKey} saved={foods} onPick={(food: FoodSearchResult) => fill(food)} onScan={() => setPanel("scan")} onAi={() => setPanel("ai")} onSearchingChange={setSearching} listClassName={DIALOG_LIST} />
        {fillNote && !searching && (
          <p role="status" className="text-sm text-muted-foreground">
            {fillNote}
          </p>
        )}
        <form onSubmit={onSubmit} noValidate hidden={searching} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-food-name">Name</Label>
            <Input id="new-food-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-food-brand">Brand (optional)</Label>
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
              Food name already saved
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <BarcodeScannerDialog open={panel === "scan"} onOpenChange={(open) => !open && setPanel((p) => (p === "scan" ? null : p))} onFound={fill} />
      {panel === "ai" && <AiPanel userId={userId} onClose={() => setPanel(null)} onUse={fillFromAi} useLabels={{ food: "Use these values", meal: "Use anyway" }} mealNote="This is a meal, not one food" />}
    </Dialog>
  );
}
