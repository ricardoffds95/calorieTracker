import { describe, expect, it, vi } from "vitest";
import { requestPlan } from "./plan-client";
import type { PlanAnswers } from "./nutrition-plan";

const answers: PlanAnswers = { sex: "female", age: 30, height_cm: 165, weight_kg: 60, body_fat_pct: null, goal: "cut", aerobic_sessions: 2, anaerobic_sessions: 1, intensity: "moderate", daily_activity: "light", notes: "" };
const PLANS = {
  cut: { calories: 1500, protein_g: 120, carbs_g: 140, fat_g: 45 },
  maintain: { calories: 1900, protein_g: 100, carbs_g: 230, fat_g: 60 },
  bulk: { calories: 2100, protein_g: 110, carbs_g: 260, fat_g: 65 },
};
const respond = (body: unknown, status: number) => async () => new Response(JSON.stringify(body), { status });

describe("requestPlan", () => {
  it("returns the plan and posts the answers as JSON", async () => {
    const fetchMock = vi.fn(respond({ plans: PLANS, summary: "Ok.", source: "ai" }, 200));
    expect(await requestPlan(answers, fetchMock)).toEqual({ ok: true, plans: PLANS, summary: "Ok.", source: "ai" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/ai/plan");
    expect(JSON.parse(init.body as string)).toEqual(answers);
  });

  it("marks the standard plan", async () => {
    const result = await requestPlan(answers, respond({ plans: PLANS, summary: "x", source: "standard" }, 200));
    expect(result).toMatchObject({ ok: true, source: "standard" });
  });

  it("maps the failures", async () => {
    expect(await requestPlan(answers, respond({}, 401))).toMatchObject({ ok: false, reason: "unauthorized" });
    expect(await requestPlan(answers, respond({ message: "A idade mínima é 14 anos." }, 400))).toEqual({ ok: false, reason: "invalid", message: "A idade mínima é 14 anos." });
    expect(await requestPlan(answers, respond({}, 500))).toMatchObject({ ok: false, reason: "unavailable" });
    expect(await requestPlan(answers, respond({ plans: { cut: {} }, summary: "x" }, 200))).toMatchObject({ ok: false, reason: "unavailable" });
    expect(await requestPlan(answers, async () => Promise.reject(new TypeError("Failed to fetch")))).toMatchObject({ ok: false, reason: "network" });
  });
});
