import { describe, expect, it } from "vitest";
import {
  calculateMacrosFromCalories,
  calculateTotalCalories,
  getCaloriesRemaining,
  getMacroStatus,
  getProgressPercent,
  goalsForMode,
} from "./macros";

describe("goalsForMode", () => {
  it("splits calories by the maintain preset (30/40/30)", () => {
    expect(goalsForMode(2000, "maintain")).toEqual({ calories: 2000, protein: 150, carbs: 200, fat: 67 });
  });
  it("splits calories by the cut preset (40/30/30)", () => {
    expect(goalsForMode(2000, "cut")).toEqual({ calories: 2000, protein: 200, carbs: 150, fat: 67 });
  });
  it("splits calories by the bulk preset (25/50/25)", () => {
    expect(goalsForMode(2000, "bulk")).toEqual({ calories: 2000, protein: 125, carbs: 250, fat: 56 });
  });
  it("handles zero calories", () => {
    expect(goalsForMode(0, "maintain")).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe("calculateMacrosFromCalories", () => {
  it("uses 4/4/9 kcal per gram and rounds grams to integers", () => {
    expect(calculateMacrosFromCalories(1800, 0.3, 0.4, 0.3)).toEqual({ calories: 1800, protein: 135, carbs: 180, fat: 60 });
  });
});

describe("calculateTotalCalories", () => {
  it("converts grams back to calories", () => {
    expect(calculateTotalCalories(150, 200, 67)).toBe(2003);
    expect(calculateTotalCalories(0, 0, 0)).toBe(0);
  });
});

describe("getProgressPercent", () => {
  it("returns a 0..1 ratio capped at 1", () => {
    expect(getProgressPercent(50, 200)).toBe(0.25);
    expect(getProgressPercent(300, 200)).toBe(1);
  });
  it("is 0 for a non-positive goal or negative consumption", () => {
    expect(getProgressPercent(50, 0)).toBe(0);
    expect(getProgressPercent(50, -10)).toBe(0);
    expect(getProgressPercent(-5, 100)).toBe(0);
  });
});

describe("getCaloriesRemaining", () => {
  it("never goes below zero", () => {
    expect(getCaloriesRemaining(1420, 2000)).toBe(580);
    expect(getCaloriesRemaining(2500, 2000)).toBe(0);
  });
});

describe("getMacroStatus", () => {
  it("is under below 90%", () => {
    expect(getMacroStatus(89, 100)).toBe("under");
    expect(getMacroStatus(0, 100)).toBe("under");
  });
  it("is good from 90% up to and including 105%", () => {
    expect(getMacroStatus(90, 100)).toBe("good");
    expect(getMacroStatus(100, 100)).toBe("good");
    expect(getMacroStatus(105, 100)).toBe("good");
  });
  it("is over above 105%", () => {
    expect(getMacroStatus(106, 100)).toBe("over");
  });
  it("copes with a zero goal", () => {
    expect(getMacroStatus(0, 0)).toBe("under");
    expect(getMacroStatus(10, 0)).toBe("over");
  });
});
