import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims } }),
}));

vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  parseFoodText: vi.fn(),
  analyzeFoodImage: vi.fn(),
}));

import { AiInvalidResponseError, AiUnavailableError, analyzeFoodImage, parseFoodText } from "@/lib/ai";
import { POST } from "./route";

const items = [{ name: "arroz", quantity_g: 100, calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 }];

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/ai/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
});

describe("POST /api/ai/parse", () => {
  it("rejects requests without a session (401) and never calls the AI", async () => {
    getClaims.mockResolvedValue({ data: null });
    const response = await post({ type: "text", text: "arroz" });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "unauthorized" });
    expect(parseFoodText).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON (400)", async () => {
    expect((await post("{not json")).status).toBe(400);
  });

  it.each([
    ["empty text", { type: "text", text: "  " }],
    ["unknown type", { type: "audio" }],
    ["bad mime type", { type: "image", image: "QUJD", mimeType: "image/gif" }],
    ["bad base64", { type: "image", image: "$$$", mimeType: "image/png" }],
  ])("rejects an invalid body (400): %s", async (_label, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_request" });
    expect(parseFoodText).not.toHaveBeenCalled();
    expect(analyzeFoodImage).not.toHaveBeenCalled();
  });

  it("returns the meal for a text request", async () => {
    vi.mocked(parseFoodText).mockResolvedValue({ name: "Arroz", kind: "food" as const, items });
    const response = await post({ type: "text", text: "  100g de arroz " });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "Arroz", kind: "food" as const, items });
    expect(parseFoodText).toHaveBeenCalledWith("100g de arroz");
  });

  it("returns the meal for an image request", async () => {
    vi.mocked(analyzeFoodImage).mockResolvedValue({ name: "Arroz", kind: "food" as const, items });
    const response = await post({ type: "image", image: "QUJD", mimeType: "image/jpeg" });
    expect(response.status).toBe(200);
    expect(analyzeFoodImage).toHaveBeenCalledWith("QUJD", "image/jpeg");
  });

  it.each(["not_configured", "auth", "quota", "server", "timeout", "network"] as const)(
    "answers 503 'AI unavailable' when the AI is unavailable (%s) without leaking the reason",
    async (reason) => {
      vi.mocked(parseFoodText).mockRejectedValue(new AiUnavailableError(reason));
      const response = await post({ type: "text", text: "arroz" });
      expect(response.status).toBe(503);
      const text = await response.text();
      expect(JSON.parse(text)).toEqual({ error: "ai_unavailable", message: "AI unavailable" });
      expect(text).not.toContain(reason === "auth" ? "auth" : "__never__");
    },
  );

  it("answers 502 when the AI returns something unusable", async () => {
    vi.mocked(parseFoodText).mockRejectedValue(new AiInvalidResponseError());
    const response = await post({ type: "text", text: "arroz" });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "ai_invalid" });
  });

  it("answers 500 without details for unexpected errors", async () => {
    vi.mocked(parseFoodText).mockRejectedValue(new Error("boom with secret"));
    const response = await post({ type: "text", text: "arroz" });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
  });
});
