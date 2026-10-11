import { z } from "zod";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";
import type { DiaryEntry } from "./diary";
import { removeItemFromMeal, roundCalories, roundMacro, scaleFromPer100g, type FoodItem } from "./nutrition";

const name = z.string().trim().min(1, "Name required").max(200, "Name too long");
const calories = z.number({ error: "Invalid value" }).min(0, "Can't be negative").max(100_000, "Too high");
const macro = z.number({ error: "Invalid value" }).min(0, "Can't be negative").max(10_000, "Too high");

export const foodEditSchema = z.object({
  name,
  quantity_g: z.number({ error: "Invalid amount" }).gt(0, "Must be above 0").max(100_000, "Too high"),
  calories,
  protein_g: macro,
  carbs_g: macro,
  fat_g: macro,
});

export const mealEditSchema = foodEditSchema.omit({ quantity_g: true });

export type FoodEditValues = z.infer<typeof foodEditSchema>;
export type MealEditValues = z.infer<typeof mealEditSchema>;

/** Items as plain JSON for the jsonb column. */
export function itemsToJson(items: readonly FoodItem[] | null): Json | null {
  if (!items) return null;
  return items.map((i) => ({
    name: i.name,
    quantity_g: i.quantity_g,
    calories: i.calories,
    protein_g: i.protein_g,
    carbs_g: i.carbs_g,
    fat_g: i.fat_g,
  }));
}

export interface EntryUpdate {
  name: string;
  quantity_g?: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Set to null when the entry no longer follows its saved food/meal (manual override). */
  saved_food_id?: null;
  saved_meal_id?: null;
}

/** Calories whole, macros 1 decimal; `quantity_g` only for food entries. */
export function toEntryUpdate(kind: DiaryEntry["kind"], values: FoodEditValues | MealEditValues): EntryUpdate {
  const base = {
    name: values.name,
    calories: roundCalories(values.calories),
    protein_g: roundMacro(values.protein_g),
    carbs_g: roundMacro(values.carbs_g),
    fat_g: roundMacro(values.fat_g),
  };
  return kind === "food" && "quantity_g" in values ? { ...base, quantity_g: roundMacro(values.quantity_g) } : base;
}

/** New nutrients when the quantity of a food entry changes (always scaled from the original entry, so no drift). */
export function rescaleEntry(
  entry: Pick<DiaryEntry, "quantity_g" | "calories" | "protein_g" | "carbs_g" | "fat_g">,
  newQuantity: number,
): { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null {
  if (!entry.quantity_g || entry.quantity_g <= 0 || !(newQuantity > 0)) return null;
  const per100 = (value: number) => (value / entry.quantity_g!) * 100;
  return scaleFromPer100g(
    {
      calories_100g: per100(entry.calories),
      protein_100g: per100(entry.protein_g),
      carbs_100g: per100(entry.carbs_g),
      fat_100g: per100(entry.fat_g),
    },
    newQuantity,
  );
}

export interface MealItemRemoval {
  items: NonNullable<DiaryEntry["items"]>;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saved_meal_id?: null;
}

/** Columns to update after removing one item of a meal entry; null if it is not possible (last item or bad index). */
export function mealItemRemovalUpdate(
  entry: Pick<DiaryEntry, "items"> & Partial<Pick<DiaryEntry, "saved_meal_id">>,
  index: number,
): MealItemRemoval | null {
  const items = entry.items;
  if (!items || items.length <= 1 || index < 0 || index >= items.length) return null;
  const { items: next, totals } = removeItemFromMeal(items, index);
  return {
    items: next,
    calories: totals.total_calories,
    protein_g: totals.total_protein,
    carbs_g: totals.total_carbs,
    fat_g: totals.total_fat,
    // The meal was customised: a later edit of the saved meal must not bring the item back.
    ...(entry.saved_meal_id ? { saved_meal_id: null } : {}),
  };
}

type LinkedEntry = Pick<
  DiaryEntry,
  "kind" | "name" | "quantity_g" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "saved_food_id" | "saved_meal_id"
>;

/**
 * Unlinks the entry from its saved food/meal when the user overrides the name or nutrients by hand,
 * so re-applying the saved item later never overwrites the correction. Changing only the quantity
 * of a food (nutrients rescaled from it) keeps the link.
 */
export function withLinkOverride(entry: LinkedEntry, update: EntryUpdate): EntryUpdate {
  const differs = (expected: { calories: number; protein_g: number; carbs_g: number; fat_g: number }) =>
    update.name !== entry.name ||
    update.calories !== expected.calories ||
    update.protein_g !== expected.protein_g ||
    update.carbs_g !== expected.carbs_g ||
    update.fat_g !== expected.fat_g;

  if (entry.kind === "food" && entry.saved_food_id) {
    const quantityChanged = update.quantity_g !== undefined && update.quantity_g !== entry.quantity_g;
    const expected = (quantityChanged && rescaleEntry(entry, update.quantity_g!)) || entry;
    return differs(expected) ? { ...update, saved_food_id: null } : update;
  }
  if (entry.kind === "meal" && entry.saved_meal_id) {
    return differs(entry) ? { ...update, saved_meal_id: null } : update;
  }
  return update;
}

/** The same row again (used by "Anular" after a delete). Keeps the original id and created_at. */
export function toInsertRow(entry: DiaryEntry): TablesInsert<"diary_entries"> {
  return {
    id: entry.id,
    user_id: entry.user_id,
    entry_date: entry.entry_date,
    meal: entry.meal,
    kind: entry.kind,
    name: entry.name,
    quantity_g: entry.quantity_g,
    calories: entry.calories,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    items: itemsToJson(entry.items),
    saved_food_id: entry.saved_food_id,
    saved_meal_id: entry.saved_meal_id,
    doses: entry.doses,
    created_at: entry.created_at,
  };
}
