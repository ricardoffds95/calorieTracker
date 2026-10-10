import type { Tables } from "@/lib/supabase/database.types";
import { MEAL_TYPES, type MacroGoals, type MacroTotals, type MealType } from "./macros";
import { roundCalories, roundMacro, type FoodItem } from "./nutrition";
import { foodItemsSchema, mealTypeSchema } from "./schemas";
import { z } from "zod";

export type DiaryRow = Tables<"diary_entries">;

export interface DiaryEntry extends Omit<DiaryRow, "meal" | "kind" | "items"> {
  meal: MealType;
  kind: "food" | "meal";
  items: FoodItem[] | null;
}

const kindSchema = z.enum(["food", "meal"]);

/** Validates a DB row (the DB stores text/jsonb) into a typed entry. Throws on corrupt rows. */
export function toDiaryEntry(row: DiaryRow): DiaryEntry {
  return {
    ...row,
    meal: mealTypeSchema.parse(row.meal),
    kind: kindSchema.parse(row.kind),
    items: row.items === null ? null : foodItemsSchema.parse(row.items),
  };
}

export function groupByMeal<T extends { meal: MealType }>(entries: readonly T[]): Record<MealType, T[]> {
  const grouped: Record<MealType, T[]> = { breakfast: [], lunch: [], dinner: [], snacks: [] };
  for (const entry of entries) grouped[entry.meal].push(entry);
  return grouped;
}

type EntryNutrients = Pick<DiaryRow, "calories" | "protein_g" | "carbs_g" | "fat_g">;

/** Whole calories, macros with 1 decimal. Safe against floating point noise (0.1 + 0.2). */
export function sumEntries(entries: readonly EntryNutrients[]): MacroTotals {
  const sum = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein_g,
      carbs: acc.carbs + e.carbs_g,
      fat: acc.fat + e.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    calories: roundCalories(sum.calories),
    protein: roundMacro(sum.protein),
    carbs: roundMacro(sum.carbs),
    fat: roundMacro(sum.fat),
  };
}

export function dayTotals(entries: readonly EntryNutrients[]): MacroTotals {
  return sumEntries(entries);
}

/** Totals for each meal of the day. */
export function mealTotals<T extends EntryNutrients & { meal: MealType }>(
  entries: readonly T[],
): Record<MealType, MacroTotals> {
  const grouped = groupByMeal(entries);
  return Object.fromEntries(MEAL_TYPES.map((m) => [m, sumEntries(grouped[m])])) as Record<MealType, MacroTotals>;
}

/** Signed: goal - consumed. Negative means the goal was exceeded. */
export function remaining(goals: MacroGoals, totals: MacroTotals): MacroTotals {
  return {
    calories: roundCalories(goals.calories - totals.calories),
    protein: roundMacro(goals.protein - totals.protein),
    carbs: roundMacro(goals.carbs - totals.carbs),
    fat: roundMacro(goals.fat - totals.fat),
  };
}
