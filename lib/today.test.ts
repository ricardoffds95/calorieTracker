import { describe, expect, it } from "vitest";
import { describeRemaining, macroColumns, mealLabel } from "./today";

describe("describeRemaining", () => {
  it("shows what is left", () => {
    expect(describeRemaining(2000, 919)).toEqual({ amount: 1081, label: "kcal restantes", over: false, progress: 0.4595 });
  });
  it("shows how much the goal was exceeded", () => {
    expect(describeRemaining(2000, 2300)).toEqual({ amount: 300, label: "kcal acima", over: true, progress: 1 });
  });
  it("is exactly on target at 0 remaining (not over)", () => {
    expect(describeRemaining(2000, 2000)).toMatchObject({ amount: 0, label: "kcal restantes", over: false, progress: 1 });
  });
  it("handles an empty day and a zero goal", () => {
    expect(describeRemaining(2000, 0)).toMatchObject({ amount: 2000, over: false, progress: 0 });
    expect(describeRemaining(0, 0)).toMatchObject({ amount: 0, over: false, progress: 0 });
  });
  it("rounds fractional calories", () => {
    expect(describeRemaining(2000, 1999.6).amount).toBe(0);
    expect(describeRemaining(2000, 2000.4).over).toBe(false);
  });
});

describe("macroColumns", () => {
  const goals = { calories: 2000, protein: 150, carbs: 200, fat: 67 };
  it("returns the three macros with progress against the goals", () => {
    const cols = macroColumns(goals, { calories: 919, protein: 75, carbs: 125, fat: 13.4 });
    expect(cols.map((c) => c.key)).toEqual(["protein", "carbs", "fat"]);
    expect(cols[0]).toMatchObject({ label: "Proteína", consumed: 75, goal: 150, progress: 0.5, over: false });
    expect(cols[1]).toMatchObject({ label: "Hidratos", consumed: 125, goal: 200, progress: 0.625, over: false });
    expect(cols[2]).toMatchObject({ label: "Gordura", consumed: 13.4, goal: 67, over: false });
  });
  it("flags a macro as over only beyond 105% and caps progress at 1", () => {
    const cols = macroColumns(goals, { calories: 0, protein: 157, carbs: 211, fat: 0 });
    expect(cols[0]).toMatchObject({ over: false, progress: 1 }); // 104.7%
    expect(cols[1]).toMatchObject({ over: true, progress: 1 }); // 105.5%
  });
});

describe("mealLabel", () => {
  it("has Portuguese names", () => {
    expect([mealLabel("breakfast"), mealLabel("lunch"), mealLabel("dinner"), mealLabel("snacks")]).toEqual([
      "Pequeno-almoço",
      "Almoço",
      "Jantar",
      "Lanches",
    ]);
  });
});
