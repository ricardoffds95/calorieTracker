import { describe, expect, it } from "vitest";
import {
  propagateSavedFoodEdit,
  propagateSavedMealEdit,
  per100gFromItems,
  removeItemFromMeal,
  roundCalories,
  roundMacro,
  scaleFromPer100g,
  scaleMealItems,
  sumItems,
  type FoodItem,
} from "./nutrition";

const chicken: FoodItem = { name: "Frango", quantity_g: 100, calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 };
const rice: FoodItem = { name: "Arroz", quantity_g: 200, calories: 260, protein_g: 5.4, carbs_g: 56, fat_g: 0.6 };

describe("rounding", () => {
  it("rounds calories to whole numbers and macros to 1 decimal", () => {
    expect(roundCalories(247.5)).toBe(248);
    expect(roundCalories(247.4)).toBe(247);
    expect(roundMacro(5.4000000000000004)).toBe(5.4);
    expect(roundMacro(0.25)).toBe(0.3);
  });
});

describe("scaleFromPer100g", () => {
  const per100 = { calories_100g: 165, protein_100g: 31, carbs_100g: 0, fat_100g: 3.6 };
  it("scales to the quantity", () => {
    expect(scaleFromPer100g(per100, 150)).toEqual({ calories: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 });
  });
  it("returns the 100 g values for 100 g and zeros for 0 g", () => {
    expect(scaleFromPer100g(per100, 100)).toEqual({ calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 });
    expect(scaleFromPer100g(per100, 0)).toEqual({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });
});

describe("scaleMealItems", () => {
  it("doubles every item", () => {
    expect(scaleMealItems([chicken], 2)).toEqual([
      { name: "Frango", quantity_g: 200, calories: 330, protein_g: 62, carbs_g: 0, fat_g: 7.2 },
    ]);
  });
  it("halves with the same rounding rules", () => {
    expect(scaleMealItems([chicken], 0.5)).toEqual([
      { name: "Frango", quantity_g: 50, calories: 83, protein_g: 15.5, carbs_g: 0, fat_g: 1.8 },
    ]);
  });
  it("does not mutate the input", () => {
    const items = [{ ...chicken }];
    scaleMealItems(items, 3);
    expect(items[0]).toEqual(chicken);
  });
});

describe("sumItems", () => {
  it("sums with whole calories and 1-decimal macros", () => {
    expect(sumItems([chicken, rice])).toEqual({
      total_calories: 425,
      total_protein: 36.4,
      total_carbs: 56,
      total_fat: 4.2,
    });
  });
  it("avoids floating point noise", () => {
    const totals = sumItems([
      { calories: 1, protein_g: 0.1, carbs_g: 0.1, fat_g: 0.1 },
      { calories: 1, protein_g: 0.2, carbs_g: 0.2, fat_g: 0.2 },
    ]);
    expect(totals.total_protein).toBe(0.3);
    expect(totals.total_carbs).toBe(0.3);
  });
  it("is all zeros for no items", () => {
    expect(sumItems([])).toEqual({ total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0 });
  });
});

describe("propagateSavedFoodEdit", () => {
  const entry = { name: "Arroz", quantity_g: 200, calories: 260, protein_g: 5.4, carbs_g: 56, fat_g: 0.6, id: "x" };
  const current = { calories_100g: 130, protein_100g: 2.7, carbs_100g: 28, fat_100g: 0.3 };

  it("recomputes the entry from the edited per 100 g values, keeping the quantity", () => {
    const result = propagateSavedFoodEdit(entry, { calories_100g: 140, protein_100g: 3 }, current);
    expect(result).toMatchObject({ quantity_g: 200, calories: 280, protein_g: 6, carbs_g: 56, fat_g: 0.6, id: "x" });
  });
  it("renames when the name changes", () => {
    expect(propagateSavedFoodEdit(entry, { name: "Arroz branco" }, current).name).toBe("Arroz branco");
  });
  it("ignores undefined fields in the edit", () => {
    const result = propagateSavedFoodEdit(entry, { calories_100g: undefined, fat_100g: 1 }, current);
    expect(result.calories).toBe(260);
    expect(result.fat_g).toBe(2);
  });
  it("handles an entry without quantity", () => {
    expect(propagateSavedFoodEdit({ ...entry, quantity_g: null }, { calories_100g: 140 }, current).calories).toBe(0);
  });
});

describe("propagateSavedMealEdit", () => {
  const entry = { name: "Almoço", items: [chicken], calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 };

  it("replaces name, items and totals", () => {
    const result = propagateSavedMealEdit(entry, { name: "Almoço novo", items: [chicken, rice] });
    expect(result).toMatchObject({ name: "Almoço novo", calories: 425, protein_g: 36.4, carbs_g: 56, fat_g: 4.2 });
    expect(result.items).toHaveLength(2);
  });
  it("applies the doses used when the meal was logged", () => {
    const result = propagateSavedMealEdit(entry, { name: "Almoço", items: [chicken] }, 2);
    expect(result.calories).toBe(330);
    expect(result.items[0]?.quantity_g).toBe(200);
  });
});

describe("removeItemFromMeal", () => {
  const three = [chicken, rice, { ...chicken, name: "Ovo" }];
  it("removes the item and recomputes totals", () => {
    const { items, totals } = removeItemFromMeal(three, 1);
    expect(items.map((i) => i.name)).toEqual(["Frango", "Ovo"]);
    expect(totals.total_calories).toBe(330);
  });
  it("never leaves a meal empty", () => {
    const { items } = removeItemFromMeal([chicken], 0);
    expect(items).toEqual([chicken]);
  });
  it("ignores out-of-range indexes", () => {
    expect(removeItemFromMeal(three, 5).items).toHaveLength(3);
    expect(removeItemFromMeal(three, -1).items).toHaveLength(3);
  });
});

describe("per100gFromItems", () => {
  const item = (quantity_g: number | null, calories: number, protein_g: number) => ({ name: "x", quantity_g, calories, protein_g, carbs_g: 0, fat_g: 0 });

  it("divides the totals by the total weight", () => {
    expect(per100gFromItems([item(100, 165, 31), item(100, 130, 2.7)])).toEqual({ calories_100g: 148, protein_100g: 16.9, carbs_100g: 0, fat_100g: 0 });
  });
  it("is null when an item has no grams", () => {
    expect(per100gFromItems([item(100, 100, 1), item(null, 50, 1)])).toBeNull();
  });
  it("is null for no items", () => {
    expect(per100gFromItems([])).toBeNull();
  });
});
