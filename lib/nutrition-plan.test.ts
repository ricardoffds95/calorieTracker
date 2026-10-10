import { describe, expect, it } from "vitest";
import { activityFactor, basalMetabolicRate, parseSavedPlans, planAnswersSchema, reconcilePlan, reconcilePlans, referencePlan, referencePlans, type PlanAnswers } from "./nutrition-plan";

const man: PlanAnswers = { sex: "male", age: 30, height_cm: 180, weight_kg: 80, body_fat_pct: null, goal: "maintain", aerobic_sessions: 1, anaerobic_sessions: 2, intensity: "moderate", daily_activity: "sedentary", notes: "" };
const woman: PlanAnswers = { sex: "female", age: 28, height_cm: 165, weight_kg: 60, body_fat_pct: null, goal: "cut", aerobic_sessions: 0, anaerobic_sessions: 0, intensity: "low", daily_activity: "sedentary", notes: "" };

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
    [0, 0, "moderate", 1.2],
    [1, 0, "moderate", 1.375],
    [1, 1, "moderate", 1.375],
    [2, 1, "moderate", 1.55],
    [2, 2, "moderate", 1.55],
    [3, 2, "moderate", 1.725],
    [3, 3, "moderate", 1.725],
    [4, 3, "moderate", 1.9],
    [7, 7, "moderate", 1.9],
  ] as const)("%s aerobic + %s anaerobic, %s → %s", (aerobic, anaerobic, intensity, factor) => expect(activityFactor(aerobic, anaerobic, intensity)).toBe(factor));

  it("weighs the sessions by their intensity", () => {
    expect(activityFactor(1, 0, "low")).toBe(1.375); // 0.75 of a session
    expect(activityFactor(2, 0, "high")).toBe(1.55); // 2.5
    expect(activityFactor(4, 0, "low")).toBe(1.55); // 3
    expect(activityFactor(4, 0, "high")).toBe(1.725); // 5
    expect(activityFactor(0, 0, "high")).toBe(1.2); // no sessions, no matter how intense
  });
});

describe("the day-to-day activity", () => {
  it("adds to the factor of the training, up to a ceiling", () => {
    expect(activityFactor(2, 1, "moderate", "sedentary")).toBe(1.55);
    expect(activityFactor(2, 1, "moderate", "light")).toBe(1.625);
    expect(activityFactor(2, 1, "moderate", "active")).toBe(1.7);
    expect(activityFactor(2, 1, "moderate", "very_active")).toBe(1.85);
    expect(activityFactor(7, 7, "high", "very_active")).toBe(2.2);
    expect(activityFactor(0, 0, "low", "very_active")).toBe(1.5); // a builder who does not train
  });
  it("a builder needs clearly more than someone working from home, with the same body and training", () => {
    const desk = referencePlan({ ...man, daily_activity: "sedentary" });
    const builder = referencePlan({ ...man, daily_activity: "very_active" });
    expect(builder.calories).toBeGreaterThan(desk.calories + 400);
  });
  it("is required", () => {
    expect(planAnswersSchema.safeParse({ ...man, daily_activity: undefined }).error?.issues[0]?.message).toBe("Indica como é o teu dia a dia.");
    expect(planAnswersSchema.safeParse({ ...man, daily_activity: "extreme" }).success).toBe(false);
  });
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
    [{ aerobic_sessions: 15 }, "Máximo 14 treinos."],
    [{ anaerobic_sessions: -1 }, "Mínimo 0 treinos."],
    [{ intensity: undefined }, "Escolhe a intensidade."],
    [{ notes: "x".repeat(2001) }, "As notas podem ter no máximo 2000 caracteres."],
  ])("rejects %j", (patch, message) => {
    const result = planAnswersSchema.safeParse({ ...man, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
  it("rejects an unknown intensity and a missing sex, and trims the notes", () => {
    expect(planAnswersSchema.safeParse({ ...man, intensity: "extreme" }).success).toBe(false);
    expect(planAnswersSchema.safeParse({ ...man, sex: undefined }).error?.issues[0]?.message).toBe("Indica o sexo.");
    expect(planAnswersSchema.parse({ ...man, notes: "  musculação 4x  " }).notes).toBe("musculação 4x");
  });
});

describe("plans for the three goals", () => {
  it("the reference gives a plan per goal, going up from losing to gaining", () => {
    const plans = referencePlans(man);
    expect(plans.cut.calories).toBeLessThan(plans.maintain.calories);
    expect(plans.maintain.calories).toBeLessThan(plans.bulk.calories);
    expect(plans.maintain).toEqual(referencePlan(man)); // the goal of the answers (maintain)
    expect(plans.bulk).toEqual(referencePlan(man, "bulk"));
  });

  it("keeps the AI's three plans when each is sensible and they go up", () => {
    const ref = referencePlans(man);
    const { plans, trusted } = reconcilePlans(ref, man);
    expect(trusted).toBe(true);
    expect(plans).toEqual(ref);
  });

  it("uses the reference for all three when one is off or they do not go up", () => {
    const ref = referencePlans(man);
    expect(reconcilePlans({ ...ref, cut: { ...ref.cut, calories: 800 } }, man)).toEqual({ plans: ref, trusted: false });
    expect(reconcilePlans({ cut: ref.maintain, maintain: ref.maintain, bulk: ref.cut }, man).trusted).toBe(false);
  });

  it("reads the saved plans of the profile, or nothing when they are not three plans", () => {
    const ref = referencePlans(man);
    expect(parseSavedPlans(JSON.parse(JSON.stringify(ref)))).toEqual(ref);
    expect(parseSavedPlans(null)).toBeNull();
    expect(parseSavedPlans({ cut: ref.cut })).toBeNull();
    expect(parseSavedPlans("x")).toBeNull();
  });
});
