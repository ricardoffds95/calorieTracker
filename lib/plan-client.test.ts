import { describe, expect, it, vi } from "vitest";
import { requestPlan } from "./plan-client";
import type { PlanAnswers } from "./nutrition-plan";

const answers: PlanAnswers = { sex: "female", age: 30, height_cm: 165, weight_kg: 60, body_fat_pct: null, goal: "cut", sessions_per_week: 3, exercise_types: [] };
const respond = (body: unknown, status: number) => async () => new Response(JSON.stringify(body), { status });

describe("requestPlan", () => {
  it("returns the plan and posts the answers as JSON", async () => {
    const fetchMock = vi.fn(respond({ calories: 1700, protein_g: 120, carbs_g: 180, fat_g: 50, summary: "Ok.", source: "ai" }, 200));
    expect(await requestPlan(answers, fetchMock)).toEqual({ ok: true, plan: { calories: 1700, protein_g: 120, carbs_g: 180, fat_g: 50 }, summary: "Ok.", source: "ai" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/ai/plan");
    expect(JSON.parse(init.body as string)).toEqual(answers);
  });

  it("marks the standard plan", async () => {
    const result = await requestPlan(answers, respond({ calories: 1700, protein_g: 120, carbs_g: 180, fat_g: 50, summary: "x", source: "standard" }, 200));
    expect(result).toMatchObject({ ok: true, source: "standard" });
  });

  it("maps the failures", async () => {
    expect(await requestPlan(answers, respond({}, 401))).toMatchObject({ ok: false, reason: "unauthorized" });
    expect(await requestPlan(answers, respond({ message: "A idade mínima é 14 anos." }, 400))).toEqual({ ok: false, reason: "invalid", message: "A idade mínima é 14 anos." });
    expect(await requestPlan(answers, respond({}, 500))).toMatchObject({ ok: false, reason: "unavailable" });
    expect(await requestPlan(answers, respond({ calories: "x" }, 200))).toMatchObject({ ok: false, reason: "unavailable" });
    expect(await requestPlan(answers, async () => Promise.reject(new TypeError("Failed to fetch")))).toMatchObject({ ok: false, reason: "network" });
  });
});
