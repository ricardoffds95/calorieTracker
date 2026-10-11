import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const ENDPOINT = "/api/ai/parse";
const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL);

test("without a session the AI endpoint answers 401 JSON (no redirect)", async ({ request }) => {
  const response = await request.post(ENDPOINT, { data: { type: "text", text: "arroz" }, maxRedirects: 0 });
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: "unauthorized" });
});

test("with a session, invalid bodies are rejected with 400", async ({ page }) => {
  await login(page, "A");
  for (const data of [{ type: "text", text: "   " }, { type: "audio" }, { type: "image", image: "$$$", mimeType: "image/png" }]) {
    const response = await page.request.post(ENDPOINT, { data });
    expect(response.status(), JSON.stringify(data)).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_request" });
  }
  const notJson = await page.request.post(ENDPOINT, { data: "{oops", headers: { "Content-Type": "application/json" } });
  expect(notJson.status()).toBe(400);
});

test.describe("AI call", () => {
  test.skip(hasGeminiKey, "Gemini is configured: covered by the live test below");

  test("without Gemini configured the endpoint answers 503 'AI unavailable'", async ({ page }) => {
    await login(page, "A");
    const response = await page.request.post(ENDPOINT, { data: { type: "text", text: "200g de arroz" } });
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({ error: "ai_unavailable", message: "AI unavailable" });
  });
});

test.describe("AI call (live Gemini)", () => {
  test.skip(!hasGeminiKey, "Set GEMINI_API_KEY and GEMINI_MODEL in .env.local to run against Gemini");

  test("text → plausible macros", async ({ page }) => {
    await login(page, "A");
    const response = await page.request.post(ENDPOINT, {
      data: { type: "text", text: "200g de frango grelhado e 150g de arroz branco cozido" },
    });
    expect(response.status()).toBe(200);
    const { name, items } = (await response.json()) as { name: string; items: { name: string; quantity_g: number; calories: number; protein_g: number }[] };
    expect(name.trim().length).toBeGreaterThan(0);
    expect(items.length).toBeGreaterThanOrEqual(2);
    const total = items.reduce((sum, i) => sum + i.calories, 0);
    expect(total).toBeGreaterThan(400);
    expect(total).toBeLessThan(900);
    expect(items.reduce((sum, i) => sum + i.protein_g, 0)).toBeGreaterThan(40);
  });
});

const PLAN_ENDPOINT = "/api/ai/plan";
const ANSWERS = { sex: "male", age: 30, height_cm: 180, weight_kg: 80, body_fat_pct: null, goal: "maintain", aerobic_sessions: 1, anaerobic_sessions: 2, intensity: "moderate", daily_activity: "sedentary", notes: "" };

test("the plan endpoint: 401 without a session, 400 for invalid answers", async ({ page, request }) => {
  const anonymous = await request.post(PLAN_ENDPOINT, { data: ANSWERS, maxRedirects: 0 });
  expect(anonymous.status()).toBe(401);

  await login(page, "A");
  const invalid = await page.request.post(PLAN_ENDPOINT, { data: { ...ANSWERS, age: 5 } });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({ error: "invalid_request", message: "Min age 14" });
});

test("the plan endpoint always answers with a usable plan, even without the AI", async ({ page }) => {
  await login(page, "A");
  const response = await page.request.post(PLAN_ENDPOINT, { data: ANSWERS });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { plans: Record<"cut" | "maintain" | "bulk", { calories: number; protein_g: number; carbs_g: number; fat_g: number }>; summary: string; source: string };
  const plan = { ...body.plans.maintain, summary: body.summary, source: body.source };
  expect(body.plans.cut.calories).toBeLessThan(body.plans.maintain.calories); // a plan for each goal, going up
  expect(body.plans.maintain.calories).toBeLessThan(body.plans.bulk.calories);
  expect(plan.calories).toBeGreaterThan(2300); // a trained 80 kg man: about 2760 kcal to maintain
  expect(plan.calories).toBeLessThan(3300);
  expect(plan.protein_g * 4 + plan.carbs_g * 4 + plan.fat_g * 9).toBeGreaterThan(plan.calories * 0.9);
  expect(plan.protein_g * 4 + plan.carbs_g * 4 + plan.fat_g * 9).toBeLessThan(plan.calories * 1.1);
  expect(plan.summary.length).toBeGreaterThan(10);
  expect(hasGeminiKey ? ["ai", "standard"] : ["standard"]).toContain(plan.source);
});
