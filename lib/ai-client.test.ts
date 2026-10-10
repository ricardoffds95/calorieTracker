import { describe, expect, it, vi } from "vitest";
import { requestAiParse } from "./ai-client";

const input = { type: "text", text: "arroz" } as const;
const items = [{ name: "arroz", quantity_g: 100, calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 }];
const respond = (body: unknown, status: number) => async () => new Response(JSON.stringify(body), { status });

describe("requestAiParse", () => {
  it("returns the meal on success and posts JSON to the endpoint", async () => {
    const fetchMock = vi.fn(respond({ name: "Arroz", items }, 200));
    expect(await requestAiParse(input, fetchMock)).toEqual({ ok: true, name: "Arroz", items });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/ai/parse");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it("names the meal when the server sends no name", async () => {
    expect(await requestAiParse(input, respond({ items }, 200))).toEqual({ ok: true, name: "Refeição", items });
  });

  it("maps 503 to unavailable with the 'IA não disponível' message", async () => {
    const result = await requestAiParse(input, respond({ error: "ai_unavailable", message: "x" }, 503));
    expect(result).toEqual({ ok: false, reason: "unavailable", message: "Modo IA não disponível de momento." });
  });

  it("maps 401 to unauthorized", async () => {
    expect(await requestAiParse(input, respond({}, 401))).toMatchObject({ ok: false, reason: "unauthorized" });
  });

  it("maps 400 and 502 to invalid, keeping the server message", async () => {
    expect(await requestAiParse(input, respond({ message: "Texto demasiado longo." }, 400))).toEqual({
      ok: false,
      reason: "invalid",
      message: "Texto demasiado longo.",
    });
    expect(await requestAiParse(input, respond({}, 502))).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("maps network failures", async () => {
    const offline = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    expect(await requestAiParse(input, offline)).toMatchObject({ ok: false, reason: "network" });
  });

  it("treats malformed or unexpected responses as unavailable", async () => {
    expect(await requestAiParse(input, async () => new Response("<html>", { status: 500 }))).toMatchObject({ reason: "unavailable" });
    expect(await requestAiParse(input, respond({}, 200))).toMatchObject({ ok: false, reason: "unavailable" });
  });
});
