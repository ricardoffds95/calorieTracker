import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims } }),
}));

vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  generateNutritionPlan: vi.fn(),
}));

import { AiInvalidResponseError, AiUnavailableError, generateNutritionPlan } from "@/lib/ai";
import { referencePlans } from "@/lib/nutrition-plan";
import { POST } from "./route";

const answers = { sex: "male", age: 30, height_cm: 180, weight_kg: 80, body_fat_pct: null, goal: "maintain", aerobic_sessions: 1, anaerobic_sessions: 2, intensity: "moderate", daily_activity: "light", notes: "" } as const;
const PLANS = {
  cut: { calories: 2300, protein_g: 160, carbs_g: 250, fat_g: 70 },
  maintain: { calories: 2800, protein_g: 150, carbs_g: 330, fat_g: 85 },
  bulk: { calories: 3050, protein_g: 160, carbs_g: 380, fat_g: 90 },
};
const post = (body: unknown) => POST(new Request("http://localhost/api/ai/plan", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.mocked(generateNutritionPlan).mockReset();
  getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
});

describe("POST /api/ai/plan", () => {
  it("is 401 without a session", async () => {
    getClaims.mockResolvedValue({ data: null });
    expect((await post(answers)).status).toBe(401);
    expect(generateNutritionPlan).not.toHaveBeenCalled();
  });

  it("is 400 for a body that is not JSON or not valid", async () => {
    expect((await post("{not json")).status).toBe(400);
    const response = await post({ ...answers, age: 5 });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_request", message: "A idade mínima é 14 anos." });
    expect(generateNutritionPlan).not.toHaveBeenCalled();
  });

  it("returns the AI's plan with its summary", async () => {
    vi.mocked(generateNutritionPlan).mockResolvedValue({ plans: PLANS, summary: "Porque sim.", source: "ai" });
    const response = await post(answers);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ plans: PLANS, summary: "Porque sim.", source: "ai" });
  });

  it.each([new AiUnavailableError("quota"), new AiInvalidResponseError()])("falls back to the standard plan when the AI fails (%s)", async (error) => {
    vi.mocked(generateNutritionPlan).mockRejectedValue(error);
    const response = await post(answers);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ plans: referencePlans(answers), source: "standard" });
  });

  it("is 500 for an unexpected error", async () => {
    vi.mocked(generateNutritionPlan).mockRejectedValue(new Error("boom"));
    expect((await post(answers)).status).toBe(500);
  });
});
