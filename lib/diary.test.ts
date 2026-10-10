import { describe, expect, it } from "vitest";
import { dayTotals, groupByMeal, mealTotals, remaining, sumEntries, toDiaryEntry, type DiaryRow } from "./diary";

const row: DiaryRow = {
  id: "1",
  user_id: "u",
  entry_date: "2026-10-10",
  meal: "lunch",
  kind: "food",
  name: "Arroz",
  quantity_g: 200,
  calories: 260,
  protein_g: 5.4,
  carbs_g: 56,
  fat_g: 0.6,
  items: null,
  saved_food_id: null,
  saved_meal_id: null,
  doses: null,
  created_at: "2026-10-10T12:00:00Z",
  updated_at: "2026-10-10T12:00:00Z",
};

describe("toDiaryEntry", () => {
  it("types a valid row", () => {
    const entry = toDiaryEntry(row);
    expect(entry.meal).toBe("lunch");
    expect(entry.kind).toBe("food");
    expect(entry.items).toBeNull();
  });
  it("parses meal items", () => {
    const items = [{ name: "Frango", quantity_g: 100, calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 }];
    expect(toDiaryEntry({ ...row, kind: "meal", items }).items).toEqual(items);
  });
  it("throws on a corrupt meal type, kind or items", () => {
    expect(() => toDiaryEntry({ ...row, meal: "brunch" })).toThrow();
    expect(() => toDiaryEntry({ ...row, kind: "drink" })).toThrow();
    expect(() => toDiaryEntry({ ...row, kind: "meal", items: [{ name: "" }] })).toThrow();
  });
});

describe("groupByMeal", () => {
  it("always returns the four meals", () => {
    const grouped = groupByMeal([{ meal: "snacks" as const }, { meal: "snacks" as const }]);
    expect(Object.keys(grouped)).toEqual(["breakfast", "lunch", "dinner", "snacks"]);
    expect(grouped.snacks).toHaveLength(2);
    expect(grouped.breakfast).toEqual([]);
  });
});

describe("sumEntries / dayTotals", () => {
  it("sums with whole calories and 1-decimal macros", () => {
    const totals = sumEntries([row, { ...row, calories: 100, protein_g: 0.1, carbs_g: 0.2, fat_g: 0.1 }]);
    expect(totals).toEqual({ calories: 360, protein: 5.5, carbs: 56.2, fat: 0.7 });
    expect(dayTotals([row])).toEqual({ calories: 260, protein: 5.4, carbs: 56, fat: 0.6 });
  });
  it("is zero for an empty day", () => {
    expect(sumEntries([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
  it("avoids floating point noise", () => {
    const a = { ...row, protein_g: 0.1, carbs_g: 0, fat_g: 0 };
    const b = { ...row, protein_g: 0.2, carbs_g: 0, fat_g: 0 };
    expect(sumEntries([a, b]).protein).toBe(0.3);
  });
});

describe("mealTotals", () => {
  it("totals each meal separately", () => {
    const lunch = { ...row, meal: "lunch" as const };
    const totals = mealTotals([lunch, { ...lunch, meal: "breakfast" as const, calories: 400 }]);
    expect(totals.lunch.calories).toBe(260);
    expect(totals.breakfast.calories).toBe(400);
    expect(totals.dinner.calories).toBe(0);
  });
});

describe("remaining", () => {
  const goals = { calories: 2000, protein: 150, carbs: 200, fat: 65 };
  it("is goal minus consumed", () => {
    expect(remaining(goals, { calories: 1420, protein: 98, carbs: 120, fat: 40 })).toEqual({
      calories: 580,
      protein: 52,
      carbs: 80,
      fat: 25,
    });
  });
  it("is negative when the goal is exceeded", () => {
    expect(remaining(goals, { calories: 2100.4, protein: 150, carbs: 200, fat: 65.5 })).toEqual({
      calories: -100,
      protein: 0,
      carbs: 0,
      fat: -0.5,
    });
  });
});
