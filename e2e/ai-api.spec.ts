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

  test("without Gemini configured the endpoint answers 503 'IA não disponível'", async ({ page }) => {
    await login(page, "A");
    const response = await page.request.post(ENDPOINT, { data: { type: "text", text: "200g de arroz" } });
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({ error: "ai_unavailable", message: "Modo IA não disponível de momento." });
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
