"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { FoodSearchResult, SavedFood } from "@/lib/food-search";
import { propagationFromDate, savedMealRow, type PropagationScope, type SavedFoodValues } from "@/lib/log";
import type { FoodItem } from "@/lib/nutrition";
import { toastSaveError } from "@/lib/queries/errors";
import { foodItemsSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

export interface SavedMeal extends Omit<Tables<"saved_meals">, "items"> {
  items: FoodItem[];
}

export const savedFoodsKey = (userId: string) => ["saved_foods", userId] as const;
export const savedMealsKey = (userId: string) => ["saved_meals", userId] as const;
const allDiaryKey = (userId: string) => ["diary", userId] as const;

/** Most used first, then alphabetical. */
function byUsage(a: { times_used: number; name: string }, b: { times_used: number; name: string }) {
  return b.times_used - a.times_used || a.name.localeCompare(b.name, "pt");
}

export function useSavedFoods(userId: string) {
  return useQuery({
    queryKey: savedFoodsKey(userId),
    queryFn: async (): Promise<SavedFood[]> => {
      const { data, error } = await createClient().from("saved_foods").select("*");
      if (error) throw error;
      return data.sort(byUsage);
    },
  });
}

export function useSavedMeals(userId: string) {
  return useQuery({
    queryKey: savedMealsKey(userId),
    queryFn: async (): Promise<SavedMeal[]> => {
      const { data, error } = await createClient().from("saved_meals").select("*");
      if (error) throw error;
      // A corrupt row must not take the whole list down.
      return data
        .flatMap((row) => {
          const items = foodItemsSchema.safeParse(row.items);
          return items.success ? [{ ...row, items: items.data }] : [];
        })
        .sort(byUsage);
    },
  });
}

/** Returns the saved food id for a search/scan result, saving it first when it is not saved yet. */
export async function ensureSavedFood(food: FoodSearchResult): Promise<string> {
  if (food.source === "saved") return food.id;
  const { data, error } = await createClient().rpc("upsert_saved_food", {
    p_name: food.name,
    p_brand: food.brand ?? "",
    p_off_code: food.off_code ?? "",
    p_calories_100g: food.calories_100g,
    p_protein_100g: food.protein_100g,
    p_carbs_100g: food.carbs_100g,
    p_fat_100g: food.fat_100g,
  });
  if (error) throw error;
  if (!data) throw new Error("Saved food not returned");
  return data;
}

/** Saves a search/scan result in "Guardados" without logging it. */
export function useSaveFoodOnly(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (food: FoodSearchResult) => ensureSavedFood(food),
    onError: (error: { message?: string }) => toastSaveError(error),
    onSuccess: () => toast.success("Guardado nos alimentos"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: savedFoodsKey(userId) }),
  });
}

/** Diary entries linked to a saved item: in total and from `todayKey` on (for the propagation dialog). */
export async function countLinkedEntries(kind: "food" | "meal", id: string, todayKey: string) {
  const column = kind === "food" ? "saved_food_id" : "saved_meal_id";
  const supabase = createClient();
  const [all, fromToday] = await Promise.all([
    supabase.from("diary_entries").select("id", { count: "exact", head: true }).eq(column, id),
    supabase.from("diary_entries").select("id", { count: "exact", head: true }).eq(column, id).gte("entry_date", todayKey),
  ]);
  if (all.error) throw all.error;
  if (fromToday.error) throw fromToday.error;
  return { all: all.count ?? 0, fromToday: fromToday.count ?? 0 };
}

interface SavedEdit<V> {
  id: string;
  values: V;
  scope: PropagationScope;
  todayKey: string;
}

function useSavedMutation<V>(
  userId: string,
  kind: "food" | "meal",
  save: (id: string, values: V) => Promise<void>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values, scope, todayKey }: SavedEdit<V>) => {
      await save(id, values);
      const fromDate = propagationFromDate(scope, todayKey);
      if (fromDate === undefined) return 0;
      const supabase = createClient();
      const { data, error } =
        kind === "food"
          ? await supabase.rpc("apply_saved_food", { p_food_id: id, ...(fromDate ? { p_from_date: fromDate } : {}) })
          : await supabase.rpc("apply_saved_meal", { p_meal_id: id, ...(fromDate ? { p_from_date: fromDate } : {}) });
      if (error) throw error;
      return data;
    },
    onError: (error: { message?: string }) => toastSaveError(error),
    onSuccess: (updated) =>
      toast.success(updated > 0 ? `Guardado e ${updated} ${updated === 1 ? "entrada atualizada" : "entradas atualizadas"}` : "Guardado"),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: kind === "food" ? savedFoodsKey(userId) : savedMealsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: allDiaryKey(userId) }),
      ]),
  });
}

function assertTouched(rows: { id: string }[] | null) {
  if (!rows || rows.length === 0) throw new Error("Saved item not found");
}

export function useUpdateSavedFood(userId: string) {
  return useSavedMutation<SavedFoodValues>(userId, "food", async (id, values) => {
    const { brand, ...rest } = values;
    const { data, error } = await createClient()
      .from("saved_foods")
      .update({ ...rest, brand: brand || null })
      .eq("id", id)
      .select("id");
    if (error) throw error;
    assertTouched(data);
  });
}

export function useUpdateSavedMeal(userId: string) {
  return useSavedMutation<{ name: string; items: FoodItem[] }>(userId, "meal", async (id, values) => {
    const { data, error } = await createClient()
      .from("saved_meals")
      .update(savedMealRow(values.name, values.items))
      .eq("id", id)
      .select("id");
    if (error) throw error;
    assertTouched(data);
  });
}

/** Error code of a unique violation: a saved meal/food with the same name already exists. */
export const DUPLICATE_NAME = "23505";

export function useCreateSavedMeal(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, items }: { name: string; items: FoodItem[] }): Promise<SavedMeal> => {
      const { data, error } = await createClient().from("saved_meals").insert(savedMealRow(name, items)).select().single();
      if (error) throw error;
      return { ...data, items: foodItemsSchema.parse(data.items) };
    },
    // A duplicate name is shown inline by the caller; everything else as a toast.
    onError: (error: { message?: string; code?: string }) => {
      if (error.code !== DUPLICATE_NAME) toastSaveError(error);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: savedMealsKey(userId) }),
  });
}

export function useCreateSavedFood(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: SavedFoodValues) => {
      const { brand, ...rest } = values;
      const { error } = await createClient().from("saved_foods").insert({ ...rest, brand: brand || null });
      if (error) throw error;
    },
    // A duplicate name is shown inline by the caller; everything else as a toast.
    onError: (error: { message?: string; code?: string }) => {
      if (error.code !== DUPLICATE_NAME) toastSaveError(error);
    },
    onSuccess: () => toast.success("Alimento guardado"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: savedFoodsKey(userId) }),
  });
}

/** Deleting keeps the diary as it is (entries just lose the link, ON DELETE SET NULL). */
export function useDeleteSaved(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, id }: { kind: "food" | "meal"; id: string }) => {
      const table = kind === "food" ? "saved_foods" : "saved_meals";
      const { data, error } = await createClient().from(table).delete().eq("id", id).select("id");
      if (error) throw error;
      assertTouched(data);
    },
    onError: (error: { message?: string }) => toastSaveError(error),
    onSuccess: () => toast("Removido dos guardados"),
    onSettled: (_data, _error, { kind }) =>
      queryClient.invalidateQueries({ queryKey: kind === "food" ? savedFoodsKey(userId) : savedMealsKey(userId) }),
  });
}
