import { describe, expect, it, vi } from "vitest";
import { OffUnavailableError, offUserAgent, searchOffServer } from "./off-search";

const hit = (code: string, name: string, kcal: number) => ({
  code,
  product_name: name,
  brands: ["Marca"],
  nutriments: { "energy-kcal_100g": kcal, proteins_100g: 10, carbohydrates_100g: 20, fat_100g: 5 },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const noSleep = async () => {};

describe("offUserAgent", () => {
  it("identifies the app with the contact email when configured", () => {
    expect(offUserAgent(" eu@exemplo.pt ")).toBe("CalorieTracker/1.0 (eu@exemplo.pt)");
    expect(offUserAgent(undefined)).toBe("CalorieTracker/1.0");
    expect(offUserAgent("  ")).toBe("CalorieTracker/1.0");
  });
});

describe("searchOffServer", () => {
  it("queries the newer search API with our User-Agent and returns usable foods", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      json({ hits: [hit("1", "Peito de frango", 110), { code: "2", product_name: "Sem nutrientes" }, hit("3", "Zero", 0), hit("4", "", 100)] }),
    );
    const results = await searchOffServer("  Peito DE frango ", { fetch: fetchMock, contactEmail: "eu@exemplo.pt", sleep: noSleep });
    expect(results.map((r) => [r.name, r.brand, r.calories_100g])).toEqual([["Peito de frango", "Marca", 110]]);
    const [url, init] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.origin + parsed.pathname).toBe("https://search.openfoodfacts.org/search");
    expect(parsed.searchParams.get("q")).toBe("peito de frango");
    expect(parsed.searchParams.get("page_size")).toBe("20");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toBe("CalorieTracker/1.0 (eu@exemplo.pt)");
  });

  it("retries once after a 503 and returns the second answer", async () => {
    const sleep = vi.fn(noSleep);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ hits: [hit("1", "Arroz", 130)] }));
    const results = await searchOffServer("arroz", { fetch: fetchMock, sleep });
    expect(results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["503", () => json({}, 503), "server"],
    ["429", () => json({}, 429), "rate_limited"],
    ["a network error", () => Promise.reject(new TypeError("fetch failed")), "network"],
    ["a timeout", () => Promise.reject(Object.assign(new Error("t"), { name: "TimeoutError" })), "timeout"],
  ])("gives up after two attempts on %s", async (_label, respond, reason) => {
    const fetchMock = vi.fn<typeof fetch>(async () => respond());
    const error = await searchOffServer("arroz", { fetch: fetchMock, sleep: noSleep }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OffUnavailableError);
    expect(error).toMatchObject({ reason });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry other 4xx answers", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => json({}, 422));
    await expect(searchOffServer("arroz", { fetch: fetchMock, sleep: noSleep })).rejects.toBeInstanceOf(OffUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a body that is not JSON as a server error", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("<html>oops</html>", { status: 200 }));
    await expect(searchOffServer("arroz", { fetch: fetchMock, sleep: noSleep })).rejects.toMatchObject({ reason: "server" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns an empty list when nothing matches", async () => {
    expect(await searchOffServer("zzzz", { fetch: async () => json({ hits: [] }), sleep: noSleep })).toEqual([]);
  });
});
