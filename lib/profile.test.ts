import { describe, expect, it } from "vitest";
import {
  parseIntegerInput,
  percentagesFromGoals,
  gramsFromPercentages,
  presetPercentages,
  profileFormSchema,
  stepValue,
  toProfileUpdate,
} from "./profile";

const valid = { name: "Ana", mode: "maintain", calories: 2000, proteinPct: 30, carbsPct: 40, fatPct: 30, proteinG: 150, carbsG: 200, fatG: 67 } as const;

describe("presetPercentages", () => {
  it("returns integers that sum to 100 for every mode", () => {
    expect(presetPercentages("cut")).toEqual({ protein: 40, carbs: 30, fat: 30 });
    expect(presetPercentages("maintain")).toEqual({ protein: 30, carbs: 40, fat: 30 });
    expect(presetPercentages("bulk")).toEqual({ protein: 25, carbs: 50, fat: 25 });
  });
});

describe("percentagesFromGoals", () => {
  it("recovers the preset percentages from their grams", () => {
    expect(percentagesFromGoals({ protein: 150, carbs: 200, fat: 67 })).toEqual({ protein: 30, carbs: 40, fat: 30 });
    expect(percentagesFromGoals({ protein: 200, carbs: 150, fat: 67 })).toEqual({ protein: 40, carbs: 30, fat: 30 });
    expect(percentagesFromGoals({ protein: 125, carbs: 250, fat: 56 })).toEqual({ protein: 25, carbs: 50, fat: 25 });
  });
  it("always sums to exactly 100, even with rounded grams (65 g of fat)", () => {
    expect(percentagesFromGoals({ protein: 150, carbs: 200, fat: 65 })).toEqual({ protein: 30, carbs: 40, fat: 30 });
    for (const [p, c, f] of [[1, 1, 1], [133, 77, 41], [200, 0, 0], [0, 0, 50], [90, 310, 22]] as const) {
      const r = percentagesFromGoals({ protein: p, carbs: c, fat: f });
      expect(r.protein + r.carbs + r.fat).toBe(100);
    }
  });
  it("falls back to the maintain preset when there are no macros", () => {
    expect(percentagesFromGoals({ protein: 0, carbs: 0, fat: 0 })).toEqual({ protein: 30, carbs: 40, fat: 30 });
  });
});

describe("profileFormSchema", () => {
  it("accepts a valid form", () => {
    expect(profileFormSchema.safeParse(valid).success).toBe(true);
  });
  it("trims the name and defaults an empty one to 'Utilizador'", () => {
    expect(profileFormSchema.parse({ ...valid, name: "  Ana  " }).name).toBe("Ana");
    expect(profileFormSchema.parse({ ...valid, name: "   " }).name).toBe("Utilizador");
  });
  it("rejects names above 50 characters", () => {
    expect(profileFormSchema.safeParse({ ...valid, name: "a".repeat(51) }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...valid, name: "a".repeat(50) }).success).toBe(true);
  });
  it.each([
    [499, false],
    [500, true],
    [10_000, true],
    [10_001, false],
    [2000.5, false],
    [Number.NaN, false],
  ])("calories %s → valid=%s", (calories, ok) => {
    expect(profileFormSchema.safeParse({ ...valid, calories }).success).toBe(ok);
  });
  it("requires the percentages to sum to exactly 100", () => {
    const result = profileFormSchema.safeParse({ ...valid, fatPct: 35 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("A soma tem de ser 100%.");
    expect(profileFormSchema.safeParse({ ...valid, proteinPct: 29 }).success).toBe(false);
  });
  it("rejects negative, >100 and fractional percentages", () => {
    expect(profileFormSchema.safeParse({ ...valid, proteinPct: -10, carbsPct: 80 }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...valid, proteinPct: 110, carbsPct: -10 }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...valid, proteinPct: 30.5, carbsPct: 39.5 }).success).toBe(false);
  });
  it("rejects an unknown mode", () => {
    expect(profileFormSchema.safeParse({ ...valid, mode: "turbo" }).success).toBe(false);
  });
});

describe("gramsFromPercentages", () => {
  it("splits the calories by the percentages", () => {
    expect(gramsFromPercentages(2400, { protein: 40, carbs: 30, fat: 30 })).toEqual({ protein: 240, carbs: 180, fat: 80 });
    expect(gramsFromPercentages(2000, { protein: 30, carbs: 40, fat: 30 })).toEqual({ protein: 150, carbs: 200, fat: 67 });
  });
});

describe("profile form grams", () => {
  it("rejects negative, fractional and absurd grams", () => {
    expect(profileFormSchema.safeParse({ ...valid, proteinG: -1 }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...valid, carbsG: 12.5 }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...valid, fatG: 2001 }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...valid, fatG: 0 }).success).toBe(true);
  });
});

describe("toProfileUpdate", () => {
  it("stores the calories and the grams exactly as set", () => {
    expect(toProfileUpdate(profileFormSchema.parse({ ...valid, mode: "cut", calories: 2400, proteinG: 240, carbsG: 180, fatG: 80 }))).toEqual({
      name: "Ana",
      mode: "cut",
      goal_calories: 2400,
      goal_protein: 240,
      goal_carbs: 180,
      goal_fat: 80,
    });
  });
  it("keeps grams that are not whole percentages (150 g of protein in 1800 kcal is 33.3%)", () => {
    const update = toProfileUpdate(profileFormSchema.parse({ ...valid, calories: 1800, proteinPct: 33, carbsPct: 34, fatPct: 33, proteinG: 150, carbsG: 150, fatG: 67 }));
    expect([update.goal_protein, update.goal_carbs, update.goal_fat]).toEqual([150, 150, 67]);
  });
});

describe("stepValue", () => {
  it("steps and clamps to the limits", () => {
    expect(stepValue(2000, 50, 500, 10_000)).toBe(2050);
    expect(stepValue(2000, -50, 500, 10_000)).toBe(1950);
    expect(stepValue(520, -50, 500, 10_000)).toBe(500);
    expect(stepValue(9990, 50, 500, 10_000)).toBe(10_000);
    expect(stepValue(5, -5, 0, 100)).toBe(0);
  });
  it("uses the fallback for an empty or invalid value", () => {
    expect(stepValue(null, 50, 500, 10_000, 2000)).toBe(2050);
    expect(stepValue(Number.NaN, 5, 0, 100, 30)).toBe(35);
    expect(stepValue(null, -5, 0, 100)).toBe(0);
  });
});

describe("parseIntegerInput", () => {
  it("parses digits only", () => {
    expect(parseIntegerInput("2400")).toBe(2400);
    expect(parseIntegerInput(" 30 ")).toBe(30);
    expect(parseIntegerInput("0")).toBe(0);
  });
  it("returns null for empty, decimals, signs and text", () => {
    for (const bad of ["", "  ", "12.5", "-3", "+3", "abc", "1e3", "1,5"]) expect(parseIntegerInput(bad)).toBeNull();
  });
});
