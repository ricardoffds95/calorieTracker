import { afterEach, describe, expect, it, vi } from "vitest";
import { AiInvalidResponseError, AiUnavailableError, analyzeFoodImage, parseFoodText } from "./ai";

const items = [{ name: "frango grelhado", quantity_g: 200, calories: 330, protein_g: 62, carbs_g: 0, fat_g: 7.2 }];

function geminiResponse(parts: unknown[], status = 200) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts } }] }), { status });
}

const base = { apiKey: "test-key", model: "test-model" };

afterEach(() => vi.unstubAllEnvs());

describe("parseFoodText", () => {
  it("returns validated items from clean JSON", async () => {
    const fetchMock = vi.fn(async () => geminiResponse([{ text: JSON.stringify(items) }]));
    expect(await parseFoodText("200g de frango", { ...base, fetch: fetchMock })).toEqual(items);
  });

  it("sends the key in a header (never in the URL), the model in the path and the user text in the prompt", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => geminiResponse([{ text: JSON.stringify(items) }]));
    await parseFoodText("200g de frango", { ...base, fetch: fetchMock });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/models/test-model:generateContent");
    expect(String(url)).not.toContain("test-key");
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(init?.body as string);
    expect(body.contents[0].parts[0].text).toContain("200g de frango");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("strips markdown fences", async () => {
    const text = "```json\n" + JSON.stringify(items) + "\n```";
    expect(await parseFoodText("x", { ...base, fetch: async () => geminiResponse([{ text }]) })).toEqual(items);
  });

  it("ignores thought parts and joins the others", async () => {
    const json = JSON.stringify(items);
    const parts = [{ text: "thinking about food...", thought: true }, { text: json.slice(0, 20) }, { text: json.slice(20) }];
    expect(await parseFoodText("x", { ...base, fetch: async () => geminiResponse(parts) })).toEqual(items);
  });

  it("coerces numeric strings returned by the model", async () => {
    const text = JSON.stringify([{ ...items[0], calories: "330" }]);
    const result = await parseFoodText("x", { ...base, fetch: async () => geminiResponse([{ text }]) });
    expect(result[0]?.calories).toBe(330);
  });

  it.each([
    ["not json", "claro, aqui está"],
    ["empty array", "[]"],
    ["an object instead of an array", JSON.stringify(items[0])],
    ["negative calories", JSON.stringify([{ ...items[0], calories: -5 }])],
    ["missing fields", JSON.stringify([{ name: "x" }])],
    ["empty text", ""],
  ])("rejects an invalid response: %s", async (_label, text) => {
    await expect(parseFoodText("x", { ...base, fetch: async () => geminiResponse([{ text }]) })).rejects.toBeInstanceOf(
      AiInvalidResponseError,
    );
  });

  it("rejects a response without candidates", async () => {
    const empty = async () => new Response(JSON.stringify({}), { status: 200 });
    await expect(parseFoodText("x", { ...base, fetch: empty })).rejects.toBeInstanceOf(AiInvalidResponseError);
    const notJson = async () => new Response("<html>", { status: 200 });
    await expect(parseFoodText("x", { ...base, fetch: notJson })).rejects.toBeInstanceOf(AiInvalidResponseError);
  });

  it.each([
    [429, "quota"],
    [401, "auth"],
    [403, "auth"],
    [500, "server"],
    [503, "server"],
  ])("maps HTTP %i to AiUnavailableError(%s)", async (status, reason) => {
    const fetchMock = async () => new Response(JSON.stringify({ error: { message: "secret detail" } }), { status });
    await expect(parseFoodText("x", { ...base, fetch: fetchMock })).rejects.toMatchObject({ name: "AiUnavailableError", reason });
  });

  it("treats other 4xx as an invalid response, not as unavailable", async () => {
    await expect(parseFoodText("x", { ...base, fetch: async () => new Response("{}", { status: 400 }) })).rejects.toBeInstanceOf(
      AiInvalidResponseError,
    );
  });

  it("maps timeouts and network failures", async () => {
    const timeout = vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    await expect(parseFoodText("x", { ...base, fetch: timeout })).rejects.toMatchObject({ reason: "timeout" });
    const offline = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(parseFoodText("x", { ...base, fetch: offline })).rejects.toMatchObject({ reason: "network" });
  });

  it("is unavailable (not configured) without key or model, and does not call the network", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GEMINI_MODEL", "");
    const fetchMock = vi.fn();
    await expect(parseFoodText("x", { fetch: fetchMock })).rejects.toMatchObject({ reason: "not_configured" });
    await expect(parseFoodText("x", { apiKey: "k", model: "", fetch: fetchMock })).rejects.toBeInstanceOf(AiUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads key and model from the environment by default", async () => {
    vi.stubEnv("GEMINI_API_KEY", "env-key");
    vi.stubEnv("GEMINI_MODEL", "env-model");
    const fetchMock = vi.fn<typeof fetch>(async () => geminiResponse([{ text: JSON.stringify(items) }]));
    await parseFoodText("x", { fetch: fetchMock });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("env-model");
    expect((fetchMock.mock.calls[0]![1]?.headers as Record<string, string>)["x-goog-api-key"]).toBe("env-key");
  });
});

describe("analyzeFoodImage", () => {
  it("sends the image inline with its mime type", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => geminiResponse([{ text: JSON.stringify(items) }]));
    const result = await analyzeFoodImage("QUJD", "image/png", { ...base, fetch: fetchMock });
    expect(result).toEqual(items);
    const body = JSON.parse(fetchMock.mock.calls[0]![1]?.body as string);
    expect(body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: "image/png", data: "QUJD" } });
  });
});
