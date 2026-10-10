"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { AddFoodSheet } from "@/components/log/add-food-sheet";
import { AddMealSheet } from "@/components/log/add-meal-sheet";
import { EditSavedDialog, type SavedTarget } from "@/components/log/edit-saved-dialog";
import { NewMealDialog } from "@/components/log/new-meal-dialog";
import { NewFoodDialog } from "@/components/saved/new-food-dialog";
import { SavedActionsSheet } from "@/components/saved/saved-actions-sheet";
import { SavedRow } from "@/components/saved/saved-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toDateKey } from "@/lib/dates";
import { filterSavedFoods, filterSavedMeals, savedToResult } from "@/lib/food-search";
import { DEFAULT_MEAL, describeTarget, foodEntryRow, mealEntryRow, type LogTarget } from "@/lib/log";
import { useAddEntries } from "@/lib/queries/diary";
import { useSavedFoods, useSavedMeals } from "@/lib/queries/saved";
import { toast } from "sonner";

const PAGE = 20;
type Tab = "foods" | "meals";

export function SavedScreen({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>("foods");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [actions, setActions] = useState<SavedTarget | null>(null); // the sheet with Editar / Adicionar / Apagar
  const [editing, setEditing] = useState<SavedTarget | null>(null);
  const [adding, setAdding] = useState<SavedTarget | null>(null);
  const [creating, setCreating] = useState<Tab | null>(null);
  const [now] = useState(() => new Date());
  const today = toDateKey(now);
  const initialTarget: LogTarget = { entry_date: today, meal: DEFAULT_MEAL };
  const add = useAddEntries(userId);

  function added(what: string, target: LogTarget) {
    setAdding(null);
    toast.success(`${what} adicionado a ${describeTarget(target, now)}`);
  }

  const foods = useSavedFoods(userId);
  const meals = useSavedMeals(userId);
  const loading = tab === "foods" ? foods.isPending : meals.isPending;
  const failed = tab === "foods" ? foods.isError && !foods.data : meals.isError && !meals.data;

  const foodRows = query.trim() ? filterSavedFoods(foods.data ?? [], query) : (foods.data ?? []);
  const mealRows = query.trim() ? filterSavedMeals(meals.data ?? [], query) : (meals.data ?? []);
  const total = tab === "foods" ? foodRows.length : mealRows.length;

  function select(next: Tab) {
    setTab(next);
    setLimit(PAGE);
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Tipo de guardado" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {(["foods", "meals"] as const).map((t) => (
          <Button
            key={t}
            type="button"
            variant="ghost"
            aria-pressed={tab === t}
            className="h-10 text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground dark:aria-pressed:bg-background"
            onClick={() => select(t)}
          >
            {t === "foods" ? `Alimentos · ${foods.data?.length ?? 0}` : `Refeições · ${meals.data?.length ?? 0}`}
          </Button>
        ))}
      </div>

      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Pesquisar nos guardados"
          placeholder="Pesquisar nos guardados"
          autoComplete="off"
          className="h-11 pl-9"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
        />
      </div>

      <Button type="button" variant="outline" className="h-11" onClick={() => setCreating(tab)}>
        <Plus aria-hidden />
        {tab === "foods" ? "Novo alimento" : "Nova refeição"}
      </Button>

      {loading && <Skeleton className="h-64 w-full" aria-label="A carregar guardados" />}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar os guardados.
        </p>
      )}
      {!loading && !failed && total === 0 && (
        <p className="text-sm text-muted-foreground">
          {query.trim()
            ? "Nada com esse nome."
            : tab === "foods"
              ? "Ainda sem alimentos guardados. Os que adicionares pela pesquisa ficam aqui."
              : "Ainda sem refeições guardadas. Cria uma acima ou a partir do registo com IA."}
        </p>
      )}

      {!loading && total > 0 && (
        <ul data-testid={`saved-${tab}`}>
          {tab === "foods"
            ? foodRows.slice(0, limit).map((food) => (
                <SavedRow
                  key={food.id}
                  name={food.name}
                  subtitle={food.brand ?? undefined}
                  energy={`${food.calories_100g} kcal/100 g`}
                  macros={`P ${food.protein_100g} · H ${food.carbs_100g} · G ${food.fat_100g}`}
                  timesUsed={food.times_used}
                  onEdit={() => setActions({ kind: "food", item: food })}
                />
              ))
            : mealRows.slice(0, limit).map((meal) => (
                <SavedRow
                  key={meal.id}
                  name={meal.name}
                  subtitle={meal.items.length > 1 ? `${meal.items.length} alimentos` : undefined}
                  energy={`${meal.total_calories} kcal`}
                  macros={`P ${meal.total_protein} · H ${meal.total_carbs} · G ${meal.total_fat}`}
                  timesUsed={meal.times_used}
                  onEdit={() => setActions({ kind: "meal", item: meal })}
                />
              ))}
        </ul>
      )}
      {total > limit && (
        <Button type="button" variant="ghost" className="h-11" onClick={() => setLimit((n) => n + PAGE)}>
          Ver mais
        </Button>
      )}

      {creating === "foods" && <NewFoodDialog userId={userId} onClose={() => setCreating(null)} />}
      {creating === "meals" && <NewMealDialog userId={userId} foods={foods.data ?? []} onClose={() => setCreating(null)} />}
      {actions && (
        <SavedActionsSheet
          key={actions.item.id}
          userId={userId}
          target={actions}
          onClose={() => setActions(null)}
          onEdit={() => {
            setEditing(actions);
            setActions(null);
          }}
          onAddToDiary={() => {
            setAdding(actions);
            setActions(null);
          }}
        />
      )}
      {adding?.kind === "food" && (
        <AddFoodSheet
          food={savedToResult(adding.item)}
          initialTarget={initialTarget}
          pending={add.isPending}
          onClose={() => setAdding(null)}
          onAdd={(food, quantity, target) =>
            add.mutate({ rows: [foodEntryRow(target, food, quantity, adding.item.id)] }, { onSuccess: () => added(food.name, target) })
          }
        />
      )}
      {adding?.kind === "meal" && (
        <AddMealSheet
          meal={adding.item}
          initialTarget={initialTarget}
          pending={add.isPending}
          onClose={() => setAdding(null)}
          onAdd={(meal, doses, target) => add.mutate({ rows: [mealEntryRow(target, meal, doses)] }, { onSuccess: () => added(meal.name, target) })}
        />
      )}
      {editing && <EditSavedDialog key={editing.item.id} userId={userId} target={editing} todayKey={today} onClose={() => setEditing(null)} />}
    </div>
  );
}
