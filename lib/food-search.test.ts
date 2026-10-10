import { describe, expect, it, vi } from "vitest";
import {
  FoodSearchError,
  filterSavedFoods,
  filterSavedMeals,
  mapProduct,
  paginate,
  pageWindow,
  searchByBarcode,
  searchOpenFoodFacts,
  searchSavedFoods,
  type SavedFood,
} from "./food-search";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
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
  it("accepts numeric strings", () => {
    const p = mapProduct({ code: "1", product_name: "X", nutriments: { "energy-kcal_100g": "100", proteins_100g: "2.25", carbohydrates_100g: 3, fat_100g: "0.04" } });
    expect(p).toMatchObject({ calories_100g: 100, protein_100g: 2.3, carbs_100g: 3, fat_100g: 0 });
  });
  it("never reads values without the _100g suffix: they may be per serving (e.g. 250 ml)", () => {
    const perServing = { "energy-kcal": 147, "energy-kcal_serving": 147, proteins: 25, carbohydrates: 11, fat: 0.4, protein_100g: 25 };
    expect(mapProduct({ code: "1", product_name: "Leite", nutriments: perServing })).toMatchObject({
      calories_100g: 0,
      protein_100g: 0,
      carbs_100g: 0,
      fat_100g: 0,
    });
  });
  it("converts the kJ of the newer API (energy-kj_100g) when kcal is missing", () => {
    expect(mapProduct({ code: "1", product_name: "X", nutriments: { "energy-kj_100g": 317 } }).calories_100g).toBe(76);
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
  const page = { results, page: 1, pageCount: 21, total: 401, totalExact: true };

  it("asks /api/food-search with the normalized query and the page, and returns the page", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(page));
    const found = await searchOpenFoodFacts("  Aveia  ", { page: 3, fetch: fetchMock });
    expect(found).toEqual({ ...page });
    const url = new URL(String(fetchMock.mock.calls[0]![0]), "http://localhost");
    expect(url.pathname).toBe("/api/food-search");
    expect(url.searchParams.get("q")).toBe("aveia");
    expect(url.searchParams.get("page")).toBe("3");
  });

  it("starts on page 1 and fills in what an older answer does not have", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ results }));
    expect(await searchOpenFoodFacts("aveia", { fetch: fetchMock })).toEqual({ results, page: 1, pageCount: 1, total: 1, totalExact: true });
    expect(new URL(String(fetchMock.mock.calls[0]![0]), "http://localhost").searchParams.get("page")).toBe("1");
  });

  it("does not call the network for queries shorter than 2 characters, but does for 2", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(page));
    expect((await searchOpenFoodFacts(" a ", { fetch: fetchMock })).results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    await searchOpenFoodFacts("ar", { fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never caches: the same search asks again every time", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(page));
    await searchOpenFoodFacts("aveia", { fetch: fetchMock });
    await searchOpenFoodFacts("aveia", { fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it("rethrows the abort when the caller cancels (new search)", async () => {
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

describe("paginate", () => {
  const items = Array.from({ length: 45 }, (_, i) => i + 1);
  it("cuts pages of 20 and counts them", () => {
    expect(paginate(items, 1)).toEqual({ items: items.slice(0, 20), pageCount: 3 });
    expect(paginate(items, 3).items).toEqual([41, 42, 43, 44, 45]);
    expect(paginate(items, 2, 10).items).toHaveLength(10);
  });
  it("clamps an out-of-range page and handles no results", () => {
    expect(paginate(items, 99).items[0]).toBe(41);
    expect(paginate(items, 0).items[0]).toBe(1);
    expect(paginate([], 1)).toEqual({ items: [], pageCount: 1 });
  });
});

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("keeps the first, the last and the neighbours of the current page", () => {
    expect(pageWindow(1, 21)).toEqual([1, 2, "…", 21]);
    expect(pageWindow(10, 21)).toEqual([1, "…", 9, 10, 11, "…", 21]);
    expect(pageWindow(21, 21)).toEqual([1, "…", 20, 21]);
  });
  it("does not use '…' for a gap of a single page", () => {
    expect(pageWindow(3, 21)).toEqual([1, 2, 3, 4, "…", 21]);
    expect(pageWindow(19, 21)).toEqual([1, "…", 18, 19, 20, 21]);
  });
});
