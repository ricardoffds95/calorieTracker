import type { MacroTotals } from "./macros";

/** One food line (also the shape stored in `items` of meals). */
export interface FoodItem {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Per100g {
  calories_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
}

export interface Nutrients {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Calories are whole numbers. */
export function roundCalories(value: number): number {
  return Math.round(value);
}

/** Macros have 1 decimal place. */
export function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

export function scaleFromPer100g(food: Per100g, quantity_g: number): Nutrients {
  const factor = quantity_g / 100;
  return {
    calories: roundCalories(food.calories_100g * factor),
    protein_g: roundMacro(food.protein_100g * factor),
    carbs_g: roundMacro(food.carbs_100g * factor),
    fat_g: roundMacro(food.fat_100g * factor),
  };
}

/** Multiplies every item of a meal by `doses` (e.g. 1.5 portions). */
export function scaleMealItems(items: readonly FoodItem[], doses: number): FoodItem[] {
  return items.map((item) => ({
    ...item,
    quantity_g: Math.round(item.quantity_g * doses),
    calories: roundCalories(item.calories * doses),
    protein_g: roundMacro(item.protein_g * doses),
    carbs_g: roundMacro(item.carbs_g * doses),
    fat_g: roundMacro(item.fat_g * doses),
  }));
}

export interface MealTotals {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

/** Sum of items: whole calories, macros with 1 decimal. */
export function sumItems(items: readonly Nutrients[]): MealTotals {
  const sum = items.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.protein_g,
      carbs: acc.carbs + i.carbs_g,
      fat: acc.fat + i.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    total_calories: roundCalories(sum.calories),
    total_protein: roundMacro(sum.protein),
    total_carbs: roundMacro(sum.carbs),
    total_fat: roundMacro(sum.fat),
  };
}

export function totalsToMacroTotals(t: MealTotals): MacroTotals {
  return { calories: t.total_calories, protein: t.total_protein, carbs: t.total_carbs, fat: t.total_fat };
}

/** Diary food entry recomputed after its saved food changed (per 100 g values and/or name). */
export function propagateSavedFoodEdit<T extends Nutrients & { quantity_g: number | null; name: string }>(
  entry: T,
  edit: Partial<Per100g> & { name?: string },
  current: Per100g,
): T {
  const quantity = entry.quantity_g ?? 0;
  const merged: Per100g = { ...current, ...stripUndefined(edit) };
  return {
    ...entry,
    name: edit.name ?? entry.name,
    ...scaleFromPer100g(merged, quantity),
  };
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Diary meal entry replaced by the edited saved meal (name, items and totals). */
export function propagateSavedMealEdit<T extends { name: string; items: FoodItem[] } & Nutrients>(
  entry: T,
  meal: { name: string; items: readonly FoodItem[] },
  doses = 1,
): T {
  const items = doses === 1 ? [...meal.items] : scaleMealItems(meal.items, doses);
  const totals = sumItems(items);
  return {
    ...entry,
    name: meal.name,
    items,
    calories: totals.total_calories,
    protein_g: totals.total_protein,
    carbs_g: totals.total_carbs,
    fat_g: totals.total_fat,
  };
}

/** Removes one item and recomputes totals. A meal is never left empty: removing the last item is a no-op. */
export function removeItemFromMeal(items: readonly FoodItem[], index: number): { items: FoodItem[]; totals: MealTotals } {
  const next = items.length > 1 && index >= 0 && index < items.length ? items.filter((_, i) => i !== index) : [...items];
  return { items: next, totals: sumItems(next) };
}
