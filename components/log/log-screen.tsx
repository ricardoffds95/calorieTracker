"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AddFoodSheet } from "@/components/log/add-food-sheet";
import { AddMealSheet } from "@/components/log/add-meal-sheet";
import { AiPanel } from "@/components/log/ai-panel";
import { BarcodeScannerDialog } from "@/components/log/barcode-scanner-dialog";
import { EditSavedDialog, type SavedTarget } from "@/components/log/edit-saved-dialog";
import { FoodSearch } from "@/components/log/food-search";
import { LogHeader, dayHref } from "@/components/log/log-header";
import { ManualEntryDialog } from "@/components/log/manual-entry-dialog";
import { SavedList } from "@/components/log/saved-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dateKeyOrToday, toDateKey } from "@/lib/dates";
import { savedToResult, type FoodSearchResult } from "@/lib/food-search";
import { foodEntryRow, itemRows, mealEntryRow, mealFromParam, type NewDiaryEntry } from "@/lib/log";
import type { MealType } from "@/lib/macros";
import { useAddEntries } from "@/lib/queries/diary";
import { ensureSavedFood, useCreateSavedMeal, useSavedFoods, useSavedMeals, type SavedMeal } from "@/lib/queries/saved";
import { mealLabel } from "@/lib/today";

// The day and default meal depend on the browser's clock, so nothing date-based renders on the server.
const subscribeNothing = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNothing, () => true, () => false);

export function LogScreen({ userId }: { userId: string }) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton className="h-96 w-full" aria-label="A carregar" />;
  return <LogDay userId={userId} />;
}

type Panel = { kind: "food"; food: FoodSearchResult } | { kind: "meal"; meal: SavedMeal } | { kind: "ai" | "manual" | "scan" } | null;

function LogDay({ userId }: { userId: string }) {
  const [now] = useState(() => new Date());
  const router = useRouter();
  const params = useSearchParams();
  const dateKey = dateKeyOrToday(params.get("d"), now);
  const meal = mealFromParam(params.get("meal"), now);
  const target = { entry_date: dateKey, meal };
  const name = mealLabel(meal);

  const [panel, setPanel] = useState<Panel>(null);
  const [editing, setEditing] = useState<SavedTarget | null>(null);
  const foods = useSavedFoods(userId);
  const meals = useSavedMeals(userId);
  const add = useAddEntries(userId);
  const createMeal = useCreateSavedMeal(userId);

  const setMeal = (m: MealType) => router.replace(`/registar?meal=${m}&d=${dateKey}`, { scroll: false });

  function addRows(rows: NewDiaryEntry[] | (() => Promise<NewDiaryEntry[]>), what: string) {
    add.mutate(
      { rows },
      {
        onSuccess: () => {
          setPanel(null);
          toast.success(`${what} adicionado a ${name.toLowerCase()}`, {
            action: { label: "Ver dia", onClick: () => router.push(dayHref(dateKey, now)) },
          });
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <LogHeader dateKey={dateKey} now={now} meal={meal} onMealChange={setMeal} />

      <FoodSearch
        saved={foods.data ?? []}
        onPick={(food) => setPanel({ kind: "food", food })}
        onScan={() => setPanel({ kind: "scan" })}
        onAi={() => setPanel({ kind: "ai" })}
      >
        <SavedList
          foods={foods.data}
          meals={meals.data}
          onPickFood={(food) => setPanel({ kind: "food", food: savedToResult(food) })}
          onPickMeal={(m) => setPanel({ kind: "meal", meal: m })}
          onEditFood={(item) => setEditing({ kind: "food", item })}
          onEditMeal={(item) => setEditing({ kind: "meal", item })}
        />
      </FoodSearch>

      <Button type="button" variant="outline" className="h-11" onClick={() => setPanel({ kind: "manual" })}>
        <Plus aria-hidden />
        Inserir manualmente
      </Button>

      {panel?.kind === "food" && (
        <AddFoodSheet
          key={panel.food.id}
          food={panel.food}
          mealName={name}
          pending={add.isPending}
          onClose={() => setPanel(null)}
          // Foods from search/scan are saved first (per 100 g) so next time they are instant.
          onAdd={(food, quantity) => addRows(async () => [foodEntryRow(target, food, quantity, await ensureSavedFood(food))], food.name)}
        />
      )}
      {panel?.kind === "meal" && (
        <AddMealSheet
          meal={panel.meal}
          target={target}
          mealName={name}
          pending={add.isPending}
          onClose={() => setPanel(null)}
          onAdd={(m, doses) => addRows([mealEntryRow(target, m, doses)], m.name)}
        />
      )}
      {panel?.kind === "ai" && (
        <AiPanel
          mealName={name}
          pending={add.isPending}
          onClose={() => setPanel(null)}
          onAdd={(items) => addRows(itemRows(target, items), items.length === 1 ? items[0]!.name : `${items.length} itens`)}
          onSaveMeal={(title, items) => createMeal.mutate({ name: title, items })}
        />
      )}
      {panel?.kind === "manual" && (
        <ManualEntryDialog
          mealName={name}
          pending={add.isPending}
          onClose={() => setPanel(null)}
          onAdd={(item, saveAs) =>
            addRows(async () => {
              const [row] = itemRows(target, [item]);
              const savedId = saveAs ? await ensureSavedFood({ ...saveAs, id: "", source: "off" }) : null;
              return [{ ...row!, saved_food_id: savedId }];
            }, item.name)
          }
        />
      )}
      <BarcodeScannerDialog
        open={panel?.kind === "scan"}
        // onFound runs before the dialog closes itself: only clear the panel if it is still the scanner.
        onOpenChange={(open) => !open && setPanel((p) => (p?.kind === "scan" ? null : p))}
        onFound={(food) => setPanel({ kind: "food", food })}
      />
      {editing && <EditSavedDialog userId={userId} target={editing} todayKey={toDateKey(now)} onClose={() => setEditing(null)} />}
    </div>
  );
}
