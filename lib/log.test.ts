import { describe, expect, it } from "vitest";
import {
  defaultMeal,
  foodEntryRow,
  itemRows,
  mealEntryRow,
  mealFromParam,
  propagationFromDate,
  savedFoodSchema,
  savedMealRow,
  servingPresets,
} from "./log";

const at = (hour: number, minute = 0) => new Date(2026, 9, 10, hour, minute);
const target = { entry_date: "2026-10-10", meal: "lunch" as const };
const rice = { name: " Arroz ", calories_100g: 130, protein_100g: 2.7, carbs_100g: 28.2, fat_100g: 0.3 };
const items = [
  { name: "Frango", quantity_g: 150, calories: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 },
  { name: "Arroz", quantity_g: 125, calories: 163, protein_g: 3.4, carbs_g: 35.3, fat_g: 0.4 },
];

describe("defaultMeal / mealFromParam", () => {
  it("follows the time of day", () => {
    expect(defaultMeal(at(7))).toBe("breakfast");
    expect(defaultMeal(at(10, 59))).toBe("breakfast");
    expect(defaultMeal(at(11))).toBe("lunch");
    expect(defaultMeal(at(16))).toBe("snacks");
    expect(defaultMeal(at(19))).toBe("dinner");
    expect(defaultMeal(at(0, 30))).toBe("breakfast");
  });
  it("uses a valid ?meal= and ignores anything else", () => {
    expect(mealFromParam("dinner", at(8))).toBe("dinner");
    expect(mealFromParam("brunch", at(8))).toBe("breakfast");
    expect(mealFromParam(null, at(20))).toBe("dinner");
  });
});

describe("foodEntryRow", () => {
  it("scales per 100 g values to the quantity and links the saved food", () => {
    expect(foodEntryRow(target, rice, 150, "sf1")).toEqual({
      entry_date: "2026-10-10",
      meal: "lunch",
      kind: "food",
      name: "Arroz",
      quantity_g: 150,
      calories: 195,
      protein_g: 4.1,
      carbs_g: 42.3,
      fat_g: 0.5,
      saved_food_id: "sf1",
    });
  });
  it("rounds the quantity to 1 decimal before scaling", () => {
    expect(foodEntryRow(target, rice, 33.333, null)).toMatchObject({ quantity_g: 33.3, calories: 43, saved_food_id: null });
  });
});

describe("mealEntryRow", () => {
  const meal = { id: "sm1", name: "Almoço", items };
  it("keeps items as saved for 1 dose and stores the doses", () => {
    expect(mealEntryRow(target, meal, 1)).toMatchObject({
      kind: "meal",
      items,
      calories: 411,
      protein_g: 49.9,
      carbs_g: 35.3,
      fat_g: 5.8,
      saved_meal_id: "sm1",
      doses: 1,
    });
  });
  it("multiplies items by the doses and sums the rounded items", () => {
    const row = mealEntryRow(target, meal, 1.5);
    expect(row.items).toEqual([
      { name: "Frango", quantity_g: 225, calories: 372, protein_g: 69.8, carbs_g: 0, fat_g: 8.1 },
      { name: "Arroz", quantity_g: 188, calories: 245, protein_g: 5.1, carbs_g: 53, fat_g: 0.6 },
    ]);
    expect(row).toMatchObject({ calories: 617, protein_g: 74.9, carbs_g: 53, fat_g: 8.7, doses: 1.5 });
  });
});

describe("itemRows", () => {
  it("creates one unlinked food entry per item, rounded", () => {
    const rows = itemRows(target, [{ name: " Pão ", quantity_g: 50.04, calories: 132.6, protein_g: 4.44, carbs_g: 25, fat_g: 1.05 }]);
    expect(rows).toEqual([
      { entry_date: "2026-10-10", meal: "lunch", kind: "food", name: "Pão", quantity_g: 50, calories: 133, protein_g: 4.4, carbs_g: 25, fat_g: 1.1 },
    ]);
  });
});

describe("servingPresets", () => {
  it("adds one serving when the size is in grams", () => {
    expect(servingPresets("30 g")).toEqual([
      { label: "100 g", grams: 100 },
      { label: "1 dose (30 g)", grams: 30 },
    ]);
    expect(servingPresets("1 tablet (12,5g)")[1]).toEqual({ label: "1 dose (12.5 g)", grams: 12.5 });
  });
  it("only offers 100 g otherwise", () => {
    expect(servingPresets(undefined)).toEqual([{ label: "100 g", grams: 100 }]);
    expect(servingPresets("1 cup")).toHaveLength(1);
    expect(servingPresets("100 g")).toHaveLength(1);
    expect(servingPresets("250 ml")).toHaveLength(1);
  });
});

describe("savedFoodSchema", () => {
  it("rounds values like the rest of the app", () => {
    expect(savedFoodSchema.parse({ name: " Aveia ", calories_100g: 379.6, protein_100g: 13.15, carbs_100g: 60, fat_100g: 7 })).toEqual({
      name: "Aveia",
      calories_100g: 380,
      protein_100g: 13.2,
      carbs_100g: 60,
      fat_100g: 7,
    });
  });
  it("rejects impossible values per 100 g", () => {
    expect(savedFoodSchema.safeParse({ name: "X", calories_100g: 1200, protein_100g: 0, carbs_100g: 0, fat_100g: 0 }).success).toBe(false);
    expect(savedFoodSchema.safeParse({ name: "X", calories_100g: 100, protein_100g: 120, carbs_100g: 0, fat_100g: 0 }).success).toBe(false);
  });
});

describe("savedMealRow / propagationFromDate", () => {
  it("derives the totals from the items", () => {
    expect(savedMealRow(" Almoço ", items)).toMatchObject({ name: "Almoço", total_calories: 411, total_protein: 49.9 });
  });
  it("maps the propagation choice to the RPC date", () => {
    expect(propagationFromDate("from_today", "2026-10-10")).toBe("2026-10-10");
    expect(propagationFromDate("all", "2026-10-10")).toBeNull();
    expect(propagationFromDate("none", "2026-10-10")).toBeUndefined();
  });
});
