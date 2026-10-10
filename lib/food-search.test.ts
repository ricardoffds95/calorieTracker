import { describe, expect, it, vi } from "vitest";
import {
  FoodSearchError,
  filterSavedFoods,
  filterSavedMeals,
  mapProduct,
  mergeResults,
  peekOffCache,
  searchByBarcode,
  searchOpenFoodFacts,
  searchSavedFoods,
  shouldSearchOnline,
  type SavedFood,
  type SearchCache,
  type SearchCacheEntry,
} from "./food-search";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function memoryCache(): SearchCache & { store: Map<string, SearchCacheEntry> } {
  const store = new Map<string, SearchCacheEntry>();
  return { store, get: async (k) => store.get(k), set: async (k, v) => void store.set(k, v) };
}

const oats = {
  code: "5601234567890",
  product_name: "Oats",
  product_name_pt: "Aveia",
  brands: "Marca X",
  nutriments: { "energy-kcal_100g": 372, proteins_100g: 13.5, carbohydrates_100g: 58.7, fat_100g: 7 },
};

describe("mapProduct", () => {
  it("maps nutriments, preferring the Portuguese name", () => {
    expect(mapProduct(oats)).toEqual({
      id: "5601234567890",
      source: "off",
      name: "Aveia",
      brand: "Marca X",
      off_code: "5601234567890",
      calories_100g: 372,
      protein_100g: 13.5,
      carbs_100g: 58.7,
      fat_100g: 7,
      serving_size: undefined,
    });
  });
  it("accepts brands as a list (newer API) or a comma separated string (old API), at most two", () => {
    expect(mapProduct({ ...oats, brands: ["Arroz Brilhante", " Cigala "] }).brand).toBe("Arroz Brilhante, Cigala");
    expect(mapProduct({ ...oats, brands: "A,B,C" }).brand).toBe("A, B");
    expect(mapProduct({ ...oats, brands: [] }).brand).toBeUndefined();
    expect(mapProduct({ ...oats, brands: undefined }).brand).toBeUndefined();
  });
  it("converts kJ to kcal when kcal is missing", () => {
    expect(mapProduct({ code: "1", product_name: "X", nutriments: { energy_100g: 1046 } }).calories_100g).toBe(250);
  });
  it("accepts numeric strings and falls back across keys", () => {
    const p = mapProduct({ code: "1", product_name: "X", nutriments: { "energy-kcal": "100", protein_100g: "2.25", carbohydrates: 3, fat: "0.04" } });
    expect(p).toMatchObject({ calories_100g: 100, protein_100g: 2.3, carbs_100g: 3, fat_100g: 0 });
  });
  it("falls back to other languages and then to the generic name", () => {
    expect(mapProduct({ product_name_en: "Rice", product_name: "Arroz?" }).name).toBe("Rice");
    expect(mapProduct({ product_name: "  Pão  " }).name).toBe("Pão");
    expect(mapProduct({}).name).toBe("");
  });
  it("uses zeros for missing nutrients", () => {
    expect(mapProduct({ code: "1", product_name: "X" })).toMatchObject({ calories_100g: 0, protein_100g: 0, carbs_100g: 0, fat_100g: 0 });
  });
  it("ignores non-numeric garbage", () => {
    expect(mapProduct({ product_name: "X", nutriments: { "energy-kcal_100g": "n/a", proteins_100g: null } }).calories_100g).toBe(0);
  });
});

describe("searchOpenFoodFacts (through our server)", () => {
  const results = [mapProduct(oats)];

  it("asks /api/food-search with the normalized query and returns the results", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ results }));
    const found = await searchOpenFoodFacts("  Aveia  ", { fetch: fetchMock });
    expect(found).toEqual({ results, fromCache: false });
    const url = new URL(String(fetchMock.mock.calls[0]![0]), "http://localhost");
    expect(url.pathname).toBe("/api/food-search");
    expect(url.searchParams.get("q")).toBe("aveia");
  });

  it("does not call the network for queries shorter than 3 characters", async () => {
    const fetchMock = vi.fn();
    expect(await searchOpenFoodFacts(" ar ", { fetch: fetchMock })).toEqual({ results: [], fromCache: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves the second identical search from the cache", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results }));
    const cache = memoryCache();
    await searchOpenFoodFacts("aveia", { fetch: fetchMock, cache });
    const second = await searchOpenFoodFacts("AVEIA ", { fetch: fetchMock, cache });
    expect(second.fromCache).toBe(true);
    expect(second.results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches once the cache entry is older than the TTL", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results }));
    const cache = memoryCache();
    let now = 1_000;
    await searchOpenFoodFacts("aveia", { fetch: fetchMock, cache, now: () => now, ttlMs: 500 });
    now = 1_400;
    expect((await searchOpenFoodFacts("aveia", { fetch: fetchMock, cache, now: () => now, ttlMs: 500 })).fromCache).toBe(true);
    now = 1_600;
    expect((await searchOpenFoodFacts("aveia", { fetch: fetchMock, cache, now: () => now, ttlMs: 500 })).fromCache).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    const cache = memoryCache();
    await expect(searchOpenFoodFacts("aveia", { fetch: async () => jsonResponse({}, 500), cache })).rejects.toThrow();
    expect(cache.store.size).toBe(0);
  });

  it.each([
    [503, "unavailable", /Open Food Facts não respondeu/],
    [401, "unauthorized", /Sessão expirada/],
    [500, "http", /Erro ao pesquisar/],
  ] as const)("maps HTTP %i to the '%s' error with its own message", async (status, kind, message) => {
    const error = await searchOpenFoodFacts("aveia", { fetch: async () => jsonResponse({}, status) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FoodSearchError);
    expect(error).toMatchObject({ kind });
    expect((error as Error).message).toMatch(message);
  });

  it("only says 'Sem ligação' when the request itself fails", async () => {
    const offline = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const error = await searchOpenFoodFacts("aveia", { fetch: offline }).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "network", message: expect.stringMatching(/^Sem ligação/) });
  });

  it("rejects a malformed answer instead of showing garbage", async () => {
    await expect(searchOpenFoodFacts("aveia", { fetch: async () => jsonResponse({ nope: true }) })).rejects.toMatchObject({ kind: "http" });
  });

  it("rethrows the abort when the caller cancels (new keystroke)", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      throw init?.signal?.reason;
    });
    const error = await searchOpenFoodFacts("aveia", { fetch: fetchMock, signal: controller.signal }).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(FoodSearchError);
  });
});

describe("searchByBarcode", () => {
  const found = { status: 1, product: { product_name: "Aveia", nutriments: { "energy-kcal_100g": 372, proteins_100g: 13.5 } } };

  it("looks up a product by barcode and keeps the code", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(found));
    const result = await searchByBarcode("5601234567890", { fetch: fetchMock });
    expect(result).toMatchObject({ name: "Aveia", off_code: "5601234567890", calories_100g: 372 });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/product/5601234567890.json");
  });
  it("extracts the barcode from a QR code URL", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(found));
    await searchByBarcode("https://example.com/p/5601234567890?x=1", { fetch: fetchMock, type: "qr" });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/product/5601234567890.json");
  });
  it("returns null without a request for non-numeric or QR codes without a number", async () => {
    const fetchMock = vi.fn();
    expect(await searchByBarcode("abc", { fetch: fetchMock })).toBeNull();
    expect(await searchByBarcode("12345", { fetch: fetchMock })).toBeNull();
    expect(await searchByBarcode("https://example.com", { fetch: fetchMock, type: "qr" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns null for unknown products and for products without useful data", async () => {
    expect(await searchByBarcode("5601234567890", { fetch: async () => jsonResponse({ status: 0 }) })).toBeNull();
    const noName = { status: 1, product: { nutriments: { "energy-kcal_100g": 10 } } };
    expect(await searchByBarcode("5601234567890", { fetch: async () => jsonResponse(noName) })).toBeNull();
    const empty = { status: 1, product: { product_name: "X", nutriments: {} } };
    expect(await searchByBarcode("5601234567890", { fetch: async () => jsonResponse(empty) })).toBeNull();
  });
  it("throws a typed error on HTTP failure", async () => {
    await expect(searchByBarcode("5601234567890", { fetch: async () => jsonResponse({}, 500) })).rejects.toMatchObject({ kind: "http" });
  });
});

const saved = (over: Partial<SavedFood>): SavedFood => ({
  id: "s",
  user_id: "u",
  name: "Arroz",
  brand: null,
  off_code: null,
  calories_100g: 130,
  protein_100g: 2.7,
  carbs_100g: 28,
  fat_100g: 0.3,
  times_used: 0,
  created_at: "",
  updated_at: "",
  ...over,
});

describe("searchSavedFoods", () => {
  const foods = [
    saved({ id: "1", name: "Pão de forma", times_used: 1 }),
    saved({ id: "2", name: "Pão integral", times_used: 9 }),
    saved({ id: "3", name: "Torrada de pão", times_used: 50 }),
    saved({ id: "4", name: "Arroz" }),
  ];
  it("ranks prefix matches first, then by usage", () => {
    expect(searchSavedFoods(foods, "pão").map((f) => f.id)).toEqual(["2", "1", "3"]);
  });
  it("is accent- and case-insensitive and matches brands", () => {
    expect(searchSavedFoods(foods, "PAO").map((f) => f.id)).toEqual(["2", "1", "3"]);
    expect(searchSavedFoods([saved({ name: "Bolacha", brand: "Marca Y" })], "marca y")).toHaveLength(1);
  });
  it("returns nothing for an empty query or no match", () => {
    expect(searchSavedFoods(foods, "  ")).toEqual([]);
    expect(searchSavedFoods(foods, "peixe")).toEqual([]);
  });
  it("marks results as saved", () => {
    expect(searchSavedFoods(foods, "arroz")[0]).toMatchObject({ source: "saved", id: "4" });
  });
});

describe("mergeResults", () => {
  it("puts saved foods first and drops OFF duplicates by barcode or name", () => {
    const savedResults = searchSavedFoods([saved({ id: "1", name: "Aveia", off_code: "111" })], "aveia");
    const off = [
      { ...mapProduct({ code: "111", product_name: "Aveia X", nutriments: { "energy-kcal_100g": 1 } }) },
      { ...mapProduct({ code: "222", product_name: "AVEIA", nutriments: { "energy-kcal_100g": 1 } }) },
      { ...mapProduct({ code: "333", product_name: "Arroz", nutriments: { "energy-kcal_100g": 1 } }) },
    ];
    expect(mergeResults(savedResults, off).map((r) => r.id)).toEqual(["1", "333"]);
  });
});

describe("peekOffCache", () => {
  const entry = { results: [mapProduct(oats)], timestamp: 1_000 };
  const cacheWith = (key: string) => {
    const cache = memoryCache();
    cache.store.set(key, entry);
    return cache;
  };

  it("returns cached results without touching the network", async () => {
    expect(await peekOffCache(" AVEIA ", { cache: cacheWith("aveia"), now: () => 1_500, ttlMs: 1_000 })).toEqual(entry.results);
  });
  it("returns undefined when nothing is cached, it expired, or the text is too short", async () => {
    expect(await peekOffCache("arroz", { cache: cacheWith("aveia") })).toBeUndefined();
    expect(await peekOffCache("aveia", { cache: cacheWith("aveia"), now: () => 5_000, ttlMs: 1_000 })).toBeUndefined();
    expect(await peekOffCache("av", { cache: cacheWith("av") })).toBeUndefined();
    expect(await peekOffCache("aveia")).toBeUndefined();
  });
});

describe("searchOpenFoodFacts with refresh", () => {
  it("ignores the cache when reading but writes the fresh answer to it", async () => {
    const cache = memoryCache();
    cache.store.set("aveia", { results: [], timestamp: Date.now() });
    const fetchMock = vi.fn(async () => jsonResponse({ results: [mapProduct(oats)] }));
    const result = await searchOpenFoodFacts("aveia", { fetch: fetchMock, cache, refresh: true });
    expect(result).toMatchObject({ fromCache: false });
    expect(result.results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cache.store.get("aveia")?.results).toHaveLength(1);
  });
});

describe("shouldSearchOnline", () => {
  const base = { forced: false, cacheRead: true, savedCount: 0, cachedCount: 0 };
  it("goes online by itself only when saved foods and the cache are both empty", () => {
    expect(shouldSearchOnline(base)).toBe(true);
    expect(shouldSearchOnline({ ...base, savedCount: 1 })).toBe(false);
    expect(shouldSearchOnline({ ...base, cachedCount: 3 })).toBe(false);
  });
  it("waits for the cache to be read before deciding", () => {
    expect(shouldSearchOnline({ ...base, cacheRead: false })).toBe(false);
  });
  it("always searches when the user asked for it", () => {
    expect(shouldSearchOnline({ forced: true, cacheRead: false, savedCount: 5, cachedCount: 5 })).toBe(true);
  });
});

describe("filterSavedFoods / filterSavedMeals", () => {
  const foods = [
    saved({ id: "a", name: "Iogurte grego", brand: "Marca", times_used: 2 }),
    saved({ id: "b", name: "Pão de iogurte", times_used: 9 }),
    saved({ id: "c", name: "Café", times_used: 1 }),
  ];
  it("matches without accents or case, prefix first and then most used", () => {
    expect(filterSavedFoods(foods, "IOGURTE").map((f) => f.id)).toEqual(["a", "b"]); // prefix before usage
    expect(filterSavedFoods(foods, "cafe").map((f) => f.id)).toEqual(["c"]);
    expect(filterSavedFoods(foods, "marca").map((f) => f.id)).toEqual(["a"]);
    expect(filterSavedFoods(foods, "  ")).toEqual([]);
  });
  it("filters meals by name", () => {
    const meals = [
      { name: "Frango com arroz", times_used: 1 },
      { name: "Bifana", times_used: 4 },
    ];
    expect(filterSavedMeals(meals, "ARROZ").map((m) => m.name)).toEqual(["Frango com arroz"]);
  });
});
