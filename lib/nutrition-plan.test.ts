import { describe, expect, it } from "vitest";
import { activityFactor, basalMetabolicRate, planAnswersSchema, reconcilePlan, referencePlan, type PlanAnswers } from "./nutrition-plan";

const man: PlanAnswers = { sex: "male", age: 30, height_cm: 180, weight_kg: 80, body_fat_pct: null, goal: "maintain", sessions_per_week: 3, exercise_types: ["strength"] };
const woman: PlanAnswers = { sex: "female", age: 28, height_cm: 165, weight_kg: 60, body_fat_pct: null, goal: "cut", sessions_per_week: 0, exercise_types: [] };

describe("basalMetabolicRate", () => {
  it("uses Mifflin-St Jeor without body fat", () => {
    expect(basalMetabolicRate(man)).toBe(1780); // 800 + 1125 − 150 + 5
    expect(basalMetabolicRate(woman)).toBeCloseTo(1330.25, 2); // 600 + 1031.25 − 140 − 161
  });
  it("uses Katch-McArdle with body fat", () => {
    expect(basalMetabolicRate({ ...man, body_fat_pct: 20 })).toBeCloseTo(1752.4, 1); // 370 + 21.6 × 64
  });
});

describe("activityFactor", () => {
  it.each([
    [0, 1.2],
    [1, 1.375],
    [2, 1.375],
    [3, 1.55],
    [4, 1.55],
    [5, 1.725],
    [6, 1.725],
    [7, 1.9],
    [14, 1.9],
  ])("%s sessions → %s", (sessions, factor) => expect(activityFactor(sessions)).toBe(factor));
});

describe("referencePlan", () => {
  it("maintenance for a trained man", () => {
    const plan = referencePlan(man); // 1780 × 1.55 = 2759 → 2760
    expect(plan.calories).toBe(2760);
    expect(plan.protein_g).toBe(128); // 1.6 g/kg
    expect(plan.fat_g).toBe(77); // 25 %
    expect(plan.carbs_g).toBe(389);
  });
  it("a deficit of 20 % for cutting, never under the floor", () => {
    expect(referencePlan({ ...man, goal: "cut" }).calories).toBe(2210);
    expect(referencePlan(woman).calories).toBe(1280); // 1330 × 1.2 × 0.8
    expect(referencePlan({ ...woman, weight_kg: 40, height_cm: 150, age: 50 }).calories).toBe(1200);
  });
  it("a surplus of 10 % and more protein for bulking", () => {
    const plan = referencePlan({ ...man, goal: "bulk" });
    expect(plan.calories).toBe(3030); // 2759 × 1.1
    expect(plan.protein_g).toBe(144);
  });
  it("macros always add up to the calories (within rounding)", () => {
    for (const a of [man, woman, { ...man, goal: "bulk" as const }, { ...man, body_fat_pct: 15 }]) {
      const p = referencePlan(a);
      expect(Math.abs(p.protein_g * 4 + p.carbs_g * 4 + p.fat_g * 9 - p.calories)).toBeLessThanOrEqual(12);
    }
  });
});

describe("reconcilePlan", () => {
  const ref = referencePlan(man);
  it("keeps a sensible AI plan, rounded", () => {
    const { plan, trusted } = reconcilePlan({ calories: 2800.4, protein_g: 150.2, carbs_g: 330, fat_g: 85 }, ref);
    expect(trusted).toBe(true);
    expect(plan).toEqual({ calories: 2800, protein_g: 150, carbs_g: 330, fat_g: 85 });
  });
  it("uses the reference when the calories are far off (±25 %)", () => {
    expect(reconcilePlan({ calories: 1500, protein_g: 150, carbs_g: 100, fat_g: 50 }, ref)).toEqual({ plan: ref, trusted: false });
    expect(reconcilePlan({ calories: 9000, protein_g: 150, carbs_g: 100, fat_g: 50 }, ref).trusted).toBe(false);
    expect(reconcilePlan({ calories: Number.NaN, protein_g: 150, carbs_g: 100, fat_g: 50 }, ref).trusted).toBe(false);
  });
  it("makes the carbs absorb a mismatch between the macros and the calories", () => {
    const { plan, trusted } = reconcilePlan({ calories: 2800, protein_g: 150, carbs_g: 100, fat_g: 80 }, ref); // macros = 1720 kcal
    expect(trusted).toBe(true);
    expect(plan.carbs_g).toBe(370); // (2800 − 600 − 720) / 4
  });
  it("falls back when protein and fat alone exceed the calories", () => {
    expect(reconcilePlan({ calories: 2300, protein_g: 400, carbs_g: 10, fat_g: 100 }, ref).trusted).toBe(false);
  });
});

describe("planAnswersSchema", () => {
  it("accepts a complete questionnaire and optional body fat", () => {
    expect(planAnswersSchema.safeParse(man).success).toBe(true);
    expect(planAnswersSchema.safeParse({ ...man, body_fat_pct: 18.5 }).success).toBe(true);
  });
  it.each([
    [{ age: 13 }, "A idade mínima é 14 anos."],
    [{ height_cm: 99 }, "A altura mínima é 100 cm."],
    [{ weight_kg: 301 }, "O peso máximo é 300 kg."],
    [{ body_fat_pct: 2 }, "Mínimo 3 %."],
    [{ sessions_per_week: 15 }, "Máximo 14."],
  ])("rejects %j", (patch, message) => {
    const result = planAnswersSchema.safeParse({ ...man, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
  it("rejects an unknown exercise and a missing sex", () => {
    expect(planAnswersSchema.safeParse({ ...man, exercise_types: ["quidditch"] }).success).toBe(false);
    expect(planAnswersSchema.safeParse({ ...man, sex: undefined }).error?.issues[0]?.message).toBe("Indica o sexo.");
  });
});
