import { describe, expect, it } from "vitest";
import type { DiaryEntry } from "./diary";
import { foodEditSchema, itemsToJson, mealEditSchema, mealItemRemovalUpdate, rescaleEntry, toEntryUpdate, toInsertRow } from "./diary-edit";

const food: DiaryEntry = {
  id: "e1",
  user_id: "u1",
  entry_date: "2026-01-15",
  meal: "breakfast",
  kind: "food",
  name: "Aveia",
  quantity_g: 60,
  calories: 224,
  protein_g: 8,
  carbs_g: 35,
  fat_g: 4,
  items: null,
  saved_food_id: "sf1",
  saved_meal_id: null,
  created_at: "2026-01-15T08:00:00Z",
  updated_at: "2026-01-15T08:00:00Z",
};

const items = [
  { name: "Frango", quantity_g: 150, calories: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 },
  { name: "Arroz", quantity_g: 200, calories: 260, protein_g: 5.4, carbs_g: 56, fat_g: 0.6 },
];
const meal: DiaryEntry = { ...food, id: "e2", kind: "meal", meal: "lunch", name: "Frango com arroz", quantity_g: null, items, calories: 508, protein_g: 51.9, carbs_g: 56, fat_g: 6, saved_food_id: null, saved_meal_id: "sm1" };

describe("foodEditSchema / mealEditSchema", () => {
  const ok = { name: "Aveia", quantity_g: 60, calories: 224, protein_g: 8, carbs_g: 35, fat_g: 4 };
  it("accepts valid values", () => {
    expect(foodEditSchema.safeParse(ok).success).toBe(true);
    expect(mealEditSchema.safeParse({ ...ok, quantity_g: undefined }).success).toBe(true);
  });
  it("requires a name and trims it", () => {
    expect(foodEditSchema.safeParse({ ...ok, name: "  " }).success).toBe(false);
    expect(foodEditSchema.parse({ ...ok, name: " Pão " }).name).toBe("Pão");
    expect(foodEditSchema.safeParse({ ...ok, name: "a".repeat(201) }).success).toBe(false);
  });
  it("requires a positive quantity for foods", () => {
    expect(foodEditSchema.safeParse({ ...ok, quantity_g: 0 }).success).toBe(false);
    expect(foodEditSchema.safeParse({ ...ok, quantity_g: -5 }).success).toBe(false);
    expect(foodEditSchema.safeParse({ ...ok, quantity_g: Number.NaN }).success).toBe(false);
  });
  it("rejects negative or absurd nutrients but allows zero", () => {
    expect(foodEditSchema.safeParse({ ...ok, calories: -1 }).success).toBe(false);
    expect(foodEditSchema.safeParse({ ...ok, protein_g: -0.1 }).success).toBe(false);
    expect(foodEditSchema.safeParse({ ...ok, calories: 100_001 }).success).toBe(false);
    expect(foodEditSchema.safeParse({ ...ok, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }).success).toBe(true);
  });
});

describe("toEntryUpdate", () => {
  it("rounds calories to whole numbers and macros to 1 decimal", () => {
    const update = toEntryUpdate("food", { name: "X", quantity_g: 33.33, calories: 100.5, protein_g: 1.26, carbs_g: 2.04, fat_g: 0.05 });
    expect(update).toEqual({ name: "X", quantity_g: 33.3, calories: 101, protein_g: 1.3, carbs_g: 2, fat_g: 0.1 });
  });
  it("omits the quantity for meals", () => {
    const update = toEntryUpdate("meal", { name: "M", calories: 500, protein_g: 10, carbs_g: 20, fat_g: 5 });
    expect(update).not.toHaveProperty("quantity_g");
  });
});

describe("rescaleEntry", () => {
  it("scales nutrients to the new quantity", () => {
    expect(rescaleEntry(food, 120)).toEqual({ calories: 448, protein_g: 16, carbs_g: 70, fat_g: 8 });
    expect(rescaleEntry(food, 30)).toEqual({ calories: 112, protein_g: 4, carbs_g: 17.5, fat_g: 2 });
  });
  it("returns the original values for the original quantity", () => {
    expect(rescaleEntry(food, 60)).toEqual({ calories: 224, protein_g: 8, carbs_g: 35, fat_g: 4 });
  });
  it("returns null when it cannot scale", () => {
    expect(rescaleEntry(food, 0)).toBeNull();
    expect(rescaleEntry(food, Number.NaN)).toBeNull();
    expect(rescaleEntry({ ...food, quantity_g: null }, 100)).toBeNull();
    expect(rescaleEntry({ ...food, quantity_g: 0 }, 100)).toBeNull();
  });
});

describe("mealItemRemovalUpdate", () => {
  it("removes the item and recomputes the totals from the remaining items", () => {
    expect(mealItemRemovalUpdate(meal, 1)).toEqual({ items: [items[0]], calories: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 });
    expect(mealItemRemovalUpdate(meal, 0)?.calories).toBe(260);
  });
  it("is not possible for the last item, a bad index or a food entry", () => {
    expect(mealItemRemovalUpdate({ items: [items[0]!] }, 0)).toBeNull();
    expect(mealItemRemovalUpdate(meal, 2)).toBeNull();
    expect(mealItemRemovalUpdate(meal, -1)).toBeNull();
    expect(mealItemRemovalUpdate(food, 0)).toBeNull();
  });
  it("does not mutate the entry", () => {
    mealItemRemovalUpdate(meal, 0);
    expect(meal.items).toHaveLength(2);
  });
});

describe("toInsertRow / itemsToJson", () => {
  it("recreates the same row, keeping id and created_at, without server-managed updated_at", () => {
    const row = toInsertRow(meal);
    expect(row).toMatchObject({ id: "e2", user_id: "u1", kind: "meal", created_at: meal.created_at, saved_meal_id: "sm1", entry_date: "2026-01-15" });
    expect(row).not.toHaveProperty("updated_at");
    expect(row.items).toEqual(items);
  });
  it("keeps items null for foods", () => {
    expect(toInsertRow(food).items).toBeNull();
    expect(itemsToJson(null)).toBeNull();
  });
});
