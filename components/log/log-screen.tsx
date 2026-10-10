"use client";

import { useState } from "react";
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
import { NewMealDialog } from "@/components/log/new-meal-dialog";
import { SavedList } from "@/components/log/saved-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMounted } from "@/components/use-mounted";
import { dateKeyOrToday, toDateKey } from "@/lib/dates";
import { savedToResult, type FoodSearchResult } from "@/lib/food-search";
import { describeTarget, foodEntryRow, itemRows, mealEntryRow, mealFromParam, type LogTarget, type NewDiaryEntry } from "@/lib/log";
import { useAddEntries } from "@/lib/queries/diary";
import { ensureSavedFood, useSaveFoodOnly, useSavedFoods, useSavedMeals, type SavedMeal } from "@/lib/queries/saved";

export function LogScreen({ userId }: { userId: string }) {
  // "Today" depends on the browser's clock, so nothing date-based renders on the server.
  if (!useMounted()) return <Skeleton className="h-96 w-full" aria-label="A carregar" />;
  return <LogDay userId={userId} />;
}

type Panel = { kind: "food"; food: FoodSearchResult; grams?: number } | { kind: "meal"; meal: SavedMeal } | { kind: "ai" | "manual" | "scan" | "newMeal" } | null;

function LogDay({ userId }: { userId: string }) {
  const [now] = useState(() => new Date());
  const router = useRouter();
  const params = useSearchParams();
  const dateKey = dateKeyOrToday(params.get("d"), now);
  // The "+" of a meal in Today pre-selects its day and meal; otherwise today, snacks. The meal is chosen when adding.
  const initialTarget: LogTarget = { entry_date: dateKey, meal: mealFromParam(params.get("meal")) };

  const [panel, setPanel] = useState<Panel>(null);
  const [kind, setKind] = useState<"foods" | "meals">("foods");
  const [editing, setEditing] = useState<SavedTarget | null>(null);
  const foods = useSavedFoods(userId);
  const meals = useSavedMeals(userId);
  const add = useAddEntries(userId);
  const saveOnly = useSaveFoodOnly(userId);

  function showAdded(message: string, day = dateKey) {
    setPanel(null);
    toast.success(message, { action: { label: "Ver dia", onClick: () => router.push(dayHref(day, now)) } });
  }

  function addRows(rows: NewDiaryEntry[] | (() => Promise<NewDiaryEntry[]>), what: string, target: LogTarget) {
    add.mutate({ rows }, { onSuccess: () => showAdded(`${what} adicionado a ${describeTarget(target, now)}`, target.entry_date) });
  }

  return (
    <div className="flex flex-col gap-5">
      <LogHeader dateKey={dateKey} now={now} />

      <div role="group" aria-label="Tipo de guardado" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {(["foods", "meals"] as const).map((k) => (
          <Button
            key={k}
            type="button"
            variant="ghost"
            aria-pressed={kind === k}
            className="h-9 text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground dark:aria-pressed:bg-background"
            onClick={() => setKind(k)}
          >
            {k === "foods" ? "Alimentos" : "Refeições"}
          </Button>
        ))}
      </div>

      <FoodSearch
        // each kind starts with its own empty search
        key={kind}
        kind={kind}
        meals={meals.data ?? []}
        onPickMeal={(meal) => setPanel({ kind: "meal", meal })}
        saved={foods.data ?? []}
        onPick={(food) => setPanel({ kind: "food", food })}
        onScan={() => setPanel({ kind: "scan" })}
        onAi={() => setPanel({ kind: "ai" })}
      >
        <SavedList
          key={kind}
          kind={kind}
          foods={foods.data}
          meals={meals.data}
          onPickFood={(food) => setPanel({ kind: "food", food: savedToResult(food) })}
          onPickMeal={(m) => setPanel({ kind: "meal", meal: m })}
          onEditFood={(item) => setEditing({ kind: "food", item })}
          onEditMeal={(item) => setEditing({ kind: "meal", item })}
          onNewMeal={() => setPanel({ kind: "newMeal" })}
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
          initialGrams={panel.grams}
          initialTarget={initialTarget}
          pending={add.isPending || saveOnly.isPending}
          onClose={() => setPanel(null)}
          // Foods from search/scan are saved first (per 100 g) so next time they are instant.
          onAdd={(food, quantity, target, save) =>
            addRows(async () => [foodEntryRow(target, food, quantity, save ? await ensureSavedFood(food) : null)], food.name, target)
          }
          onSaveOnly={(food) => saveOnly.mutate(food, { onSuccess: () => setPanel(null) })}
        />
      )}
      {panel?.kind === "meal" && (
        <AddMealSheet
          meal={panel.meal}
          initialTarget={initialTarget}
          pending={add.isPending}
          onClose={() => setPanel(null)}
          onAdd={(m, doses, target) => addRows([mealEntryRow(target, m, doses)], m.name, target)}
        />
      )}
      {panel?.kind === "ai" && <AiPanel
          userId={userId}
          initialTarget={initialTarget}
          now={now}
          onClose={() => setPanel(null)}
          onAdded={showAdded}
          onFood={(food, grams) => setPanel({ kind: "food", food, grams })}
        />}
      {panel?.kind === "newMeal" && (
        <NewMealDialog userId={userId} initialTarget={initialTarget} now={now} foods={foods.data ?? []} onClose={() => setPanel(null)} onAdded={showAdded} />
      )}
      {panel?.kind === "manual" && (
        <ManualEntryDialog
          initialTarget={initialTarget}
          pending={add.isPending}
          onClose={() => setPanel(null)}
          onAdd={(item, saveAs, target) =>
            addRows(
              async () => {
                const [row] = itemRows(target, [item]);
                const savedId = saveAs ? await ensureSavedFood({ ...saveAs, id: "", source: "off" }) : null;
                return [{ ...row!, saved_food_id: savedId }];
              },
              item.name,
              target,
            )
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
