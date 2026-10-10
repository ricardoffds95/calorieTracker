import { z } from "zod";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { itemsToJson } from "./diary-edit";
import { MEAL_TYPES, type MealType } from "./macros";
import { roundCalories, roundMacro, scaleFromPer100g, scaleMealItems, sumItems, type FoodItem, type Per100g } from "./nutrition";
import { foodItemsSchema } from "./schemas";

export type NewDiaryEntry = TablesInsert<"diary_entries">;

/** Where new entries go: the day and the meal of the Log screen. */
export interface LogTarget {
  entry_date: string;
  meal: MealType;
}

/** Meal suggested when the Log screen is opened from the tab bar (local time). */
export function defaultMeal(now: Date): MealType {
  const hour = now.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 19) return "snacks";
  return "dinner";
}

/** The `?meal=` parameter when valid, otherwise the meal for the current time. */
export function mealFromParam(param: string | null | undefined, now: Date): MealType {
  return (MEAL_TYPES as readonly string[]).includes(param ?? "") ? (param as MealType) : defaultMeal(now);
}

export const MAX_QUANTITY_G = 5000;
export const quantitySchema = z
  .number({ error: "Quantidade inválida." })
  .gt(0, "Tem de ser maior que 0.")
  .max(MAX_QUANTITY_G, "Valor demasiado alto.");

/** "1 porção", "1.5 porções" (meals are counted in portions; the DB column is `doses`). */
export function portionsLabel(portions: number): string {
  return `${portions} ${portions === 1 ? "porção" : "porções"}`;
}

export const DOSE_STEP = 0.5;
export const MAX_DOSES = 20;
export const dosesSchema = z.number().min(DOSE_STEP).max(MAX_DOSES);

/** A food entry for `quantity_g` grams of a food known per 100 g (search, scan or saved). */
export function foodEntryRow(
  target: LogTarget,
  food: Per100g & { name: string },
  quantity_g: number,
  savedFoodId: string | null,
): NewDiaryEntry {
  const quantity = roundMacro(quantity_g);
  return {
    ...target,
    kind: "food",
    name: food.name.trim(),
    quantity_g: quantity,
    ...scaleFromPer100g(food, quantity),
    saved_food_id: savedFoodId,
  };
}

/**
 * A meal entry for `doses` portions; doses are stored so later edits of the saved meal re-apply them.
 * `id` null: a meal that is not saved (e.g. "Só adicionar ao diário" from the AI).
 */
export function mealEntryRow(
  target: LogTarget,
  meal: { id: string | null; name: string; items: readonly FoodItem[] },
  doses: number,
): NewDiaryEntry {
  const items = doses === 1 ? [...meal.items] : scaleMealItems(meal.items, doses);
  const totals = sumItems(items);
  return {
    ...target,
    kind: "meal",
    name: meal.name,
    items: itemsToJson(items),
    calories: totals.total_calories,
    protein_g: totals.total_protein,
    carbs_g: totals.total_carbs,
    fat_g: totals.total_fat,
    saved_meal_id: meal.id,
    doses,
  };
}

/** One food entry per item (manual entry, in grams); not linked to saved foods. */
export function itemRows(target: LogTarget, items: readonly (FoodItem & { quantity_g: number })[]): NewDiaryEntry[] {
  return items.map((item) => ({
    ...target,
    kind: "food",
    name: item.name.trim(),
    quantity_g: roundMacro(item.quantity_g),
    calories: roundCalories(item.calories),
    protein_g: roundMacro(item.protein_g),
    carbs_g: roundMacro(item.carbs_g),
    fat_g: roundMacro(item.fat_g),
  }));
}

export interface QuantityPreset {
  label: string;
  grams: number;
}

/** Quick quantities: 100 g plus one serving when Open Food Facts gives it in grams ("30 g", "1 tablet (40g)"). */
export function servingPresets(servingSize: string | undefined): QuantityPreset[] {
  const presets: QuantityPreset[] = [{ label: "100 g", grams: 100 }];
  const match = servingSize?.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
  const amount = match ? Number(match[1]!.replace(",", ".")) : Number.NaN;
  // Drinks are given in ml: 1 ml is counted as 1 g (water-like), the unit the food is stored in.
  if (amount > 0 && amount <= MAX_QUANTITY_G && amount !== 100) {
    presets.push({ label: `1 dose (${roundMacro(amount)} ${match![2]!.toLowerCase()})`, grams: roundMacro(amount) });
  }
  return presets;
}

const name = z.string().trim().min(1, "Indica um nome.").max(200, "Nome demasiado longo.");
const per100 = (max: number) =>
  z.number({ error: "Valor inválido." }).min(0, "Não pode ser negativo.").max(max, `Máximo ${max} por 100 g.`);

/** A saved food, values per 100 g. */
export const savedFoodSchema = z.object({
  name,
  brand: z.string().trim().max(200).optional(),
  calories_100g: per100(900).transform(roundCalories),
  protein_100g: per100(100).transform(roundMacro),
  carbs_100g: per100(100).transform(roundMacro),
  fat_100g: per100(100).transform(roundMacro),
});
export type SavedFoodValues = z.output<typeof savedFoodSchema>;

/** A saved meal: name and items; totals are always derived from the items. */
export const savedMealSchema = z.object({ name, items: foodItemsSchema });

export function savedMealRow(name: string, items: readonly FoodItem[]) {
  const totals = sumItems(items);
  return { name: name.trim(), items: itemsToJson(items) ?? [], ...totals };
}

/** How an edit of a saved food/meal is applied to the diary. */
export type PropagationScope = "from_today" | "all" | "none";

/** `p_from_date` for apply_saved_*: today, the whole history (null), or no call at all (undefined). */
export function propagationFromDate(scope: PropagationScope, todayKey: string): string | null | undefined {
  if (scope === "from_today") return todayKey;
  if (scope === "all") return null;
  return undefined;
}
