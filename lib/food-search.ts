import type { Tables } from "@/lib/supabase/database.types";
import { roundCalories, roundMacro, type Per100g } from "./nutrition";

export type SavedFood = Tables<"saved_foods">;

export interface FoodSearchResult extends Per100g {
  /** Saved food id, or Open Food Facts barcode. */
  id: string;
  source: "saved" | "off";
  name: string;
  brand?: string;
  off_code?: string;
  serving_size?: string;
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_pt?: string;
  product_name_en?: string;
  product_name_es?: string;
  product_name_fr?: string;
  /** A string in the old API ("A,B"), a list in the newer one. */
  brands?: string | string[];
  serving_size?: string;
  nutriments?: Record<string, unknown>;
}

export type FoodSearchErrorKind = "network" | "http" | "timeout" | "unavailable" | "unauthorized";

export class FoodSearchError extends Error {
  constructor(message: string, readonly kind: FoodSearchErrorKind) {
    super(message);
    this.name = "FoodSearchError";
  }
}

/** A search needs at least this many letters (a single letter returns noise and wastes requests). */
export const MIN_QUERY_LENGTH = 2;
/** Results per page, in both tabs (saved foods and Open Food Facts). */
export const PAGE_SIZE = 20;
/** Deeper pages are slow on the Open Food Facts side and nobody reads them: 25 pages = 500 results. */
export const MAX_PAGES = 25;

/** One page of search results. */
export interface SearchPage {
  results: FoodSearchResult[];
  page: number;
  pageCount: number;
  /** Matches found, as reported by Open Food Facts (may include products that are not usable). */
  total: number;
  /** False when `total` is a lower bound (e.g. "10000+"). */
  totalExact: boolean;
}

const OFF_FIELDS =
  "code,product_name,product_name_pt,product_name_en,product_name_es,product_name_fr,brands,nutriments,serving_size";

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

/** First defined value among the keys of `nutriments`. */
function pick(nutriments: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = num(nutriments[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

export function mapProduct(product: OffProduct): FoodSearchResult {
  const nutriments = product.nutriments ?? {};
  const name = (
    product.product_name_pt ||
    product.product_name_en ||
    product.product_name_es ||
    product.product_name_fr ||
    product.product_name ||
    ""
  ).trim();

  // Only the *_100g fields: the ones without suffix are "as entered" and may be per serving (e.g. 250 ml).
  const kj = pick(nutriments, "energy-kj_100g", "energy_100g");
  const kcal = pick(nutriments, "energy-kcal_100g") ?? (kj !== undefined ? kj / 4.184 : 0);

  return {
    id: product.code ?? "",
    source: "off",
    name,
    brand: formatBrands(product.brands),
    off_code: product.code,
    calories_100g: roundCalories(kcal),
    protein_100g: roundMacro(pick(nutriments, "proteins_100g") ?? 0),
    carbs_100g: roundMacro(pick(nutriments, "carbohydrates_100g") ?? 0),
    fat_100g: roundMacro(pick(nutriments, "fat_100g") ?? 0),
    serving_size: product.serving_size?.trim() || undefined,
  };
}

function formatBrands(brands: OffProduct["brands"]): string | undefined {
  const list = Array.isArray(brands) ? brands : (brands ?? "").split(",");
  const text = list
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  return text || undefined;
}

/** Products without a name or without any energy are not useful to log. */
export function isUsable(result: FoodSearchResult): boolean {
  return result.name.length > 0 && result.calories_100g > 0;
}

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Lowercase, accent-insensitive form for matching. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export interface FetchOptions {
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

async function getJson(url: string, { fetch: fetchFn = fetch, signal }: FetchOptions, timeoutMs: number): Promise<unknown> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetchFn(url, { signal: combined });
  } catch (error) {
    if (signal?.aborted) throw error; // caller cancelled (e.g. new keystroke): not an error to show
    if (timeout.aborted) throw new FoodSearchError("Search timed out", "timeout");
    throw new FoodSearchError("No connection", "network");
  }
  if (!response.ok) throw new FoodSearchError(`Search failed (${response.status})`, "http");
  return response.json();
}

export interface SearchOffOptions extends FetchOptions {
  page?: number;
}

const SEARCH_ENDPOINT = "/api/food-search";
// The server tries twice (8 s each) before giving up.
const SEARCH_TIMEOUT_MS = 20_000;

export const FOOD_SEARCH_MESSAGES: Record<"network" | "timeout" | "unavailable" | "unauthorized" | "http", string> = {
  network: "No connection",
  timeout: "Search timed out",
  unavailable: "Open Food Facts not responding",
  unauthorized: "Session expired",
  http: "Search failed",
};

/** Searches Open Food Facts through our server (`/api/food-search`), which retries on failures. Nothing is cached. */
export async function searchOpenFoodFacts(query: string, options: SearchOffOptions = {}): Promise<SearchPage> {
  const normalized = normalizeQuery(query);
  const { page = 1, fetch: fetchFn = fetch, signal } = options;
  if (normalized.length < MIN_QUERY_LENGTH) return { results: [], page: 1, pageCount: 0, total: 0, totalExact: true };

  const timeout = AbortSignal.timeout(SEARCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchFn(`${SEARCH_ENDPOINT}?${new URLSearchParams({ q: normalized, page: String(page) })}`, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error; // caller cancelled (e.g. new search): not an error to show
    throw new FoodSearchError(FOOD_SEARCH_MESSAGES[timeout.aborted ? "timeout" : "network"], timeout.aborted ? "timeout" : "network");
  }
  if (response.status === 401) throw new FoodSearchError(FOOD_SEARCH_MESSAGES.unauthorized, "unauthorized");
  if (response.status === 503) throw new FoodSearchError(FOOD_SEARCH_MESSAGES.unavailable, "unavailable");
  if (!response.ok) throw new FoodSearchError(FOOD_SEARCH_MESSAGES.http, "http");

  const data = (await response.json().catch(() => null)) as Partial<SearchPage> | null;
  if (!data || !Array.isArray(data.results)) throw new FoodSearchError(FOOD_SEARCH_MESSAGES.http, "http");
  return {
    results: data.results,
    page: data.page ?? page,
    pageCount: data.pageCount ?? 1,
    total: data.total ?? data.results.length,
    totalExact: data.totalExact ?? true,
  };
}

/** A product barcode (EAN/UPC): 8 to 14 digits. */
function extractBarcode(raw: string, type?: string): string | null {
  const text = raw.trim();
  if (type === "qr") return text.match(/\d{8,14}/)?.[0] ?? null;
  return /^\d{8,14}$/.test(text) ? text : null;
}

export async function searchByBarcode(
  barcode: string,
  options: FetchOptions & { type?: string } = {},
): Promise<FoodSearchResult | null> {
  const code = extractBarcode(barcode, options.type);
  if (!code) return null;

  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`;
  const data = (await getJson(url, options, 12_000)) as { status?: number; product?: OffProduct };
  if (data.status !== 1 || !data.product) return null;

  const mapped = mapProduct({ ...data.product, code });
  if (!mapped.name) return null;
  if (mapped.calories_100g === 0 && mapped.protein_100g === 0 && mapped.carbs_100g === 0) return null;
  return mapped;
}

export function savedToResult(food: SavedFood): FoodSearchResult {
  return {
    id: food.id,
    source: "saved",
    name: food.name,
    brand: food.brand ?? undefined,
    off_code: food.off_code ?? undefined,
    calories_100g: food.calories_100g,
    protein_100g: food.protein_100g,
    carbs_100g: food.carbs_100g,
    fat_100g: food.fat_100g,
  };
}

/** Accent- and case-insensitive match on name (and brand): prefix matches first, then most used, then A-Z. */
function matchSaved<T extends { name: string; brand?: string | null; times_used: number }>(items: readonly T[], query: string): T[] {
  const needle = fold(normalizeQuery(query));
  if (needle.length === 0) return [];
  return items
    .filter((f) => fold(`${f.name} ${f.brand ?? ""}`).includes(needle))
    .sort((a, b) => {
      const aPrefix = fold(a.name).startsWith(needle) ? 0 : 1;
      const bPrefix = fold(b.name).startsWith(needle) ? 0 : 1;
      return aPrefix - bPrefix || b.times_used - a.times_used || a.name.localeCompare(b.name, "pt");
    });
}

/** Instant, local search over the user's saved foods. */
export function searchSavedFoods(saved: readonly SavedFood[], query: string): FoodSearchResult[] {
  return matchSaved(saved, query).map(savedToResult);
}

/** A saved food or a saved meal that matches a search. */
export type SavedHit<M> = { kind: "food"; food: FoodSearchResult } | { kind: "meal"; meal: M };

/** Foods and meals together, ranked like `matchSaved` (prefix first, then most used, then A-Z). */
export function searchSavedAll<M extends { name: string; times_used: number }>(
  foods: readonly SavedFood[],
  meals: readonly M[],
  query: string,
): SavedHit<M>[] {
  const tagged = [
    ...foods.map((food) => ({ name: food.name, brand: food.brand, times_used: food.times_used, hit: { kind: "food", food: savedToResult(food) } as SavedHit<M> })),
    ...meals.map((meal) => ({ name: meal.name, brand: null, times_used: meal.times_used, hit: { kind: "meal", meal } as SavedHit<M> })),
  ];
  return matchSaved(tagged, query).map((t) => t.hit);
}

/** The same for the saved foods list of the Guardados tab (full rows, not search results). */
export function filterSavedFoods(saved: readonly SavedFood[], query: string): SavedFood[] {
  return matchSaved(saved, query);
}

/** Saved meals whose name matches the query. */
export function filterSavedMeals<T extends { name: string; times_used: number }>(meals: readonly T[], query: string): T[] {
  return matchSaved(meals, query);
}

/** The items of page `page` (1-based) and the number of pages. */
export function paginate<T>(items: readonly T[], page: number, size = PAGE_SIZE): { items: T[]; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page)), pageCount);
  return { items: items.slice((current - 1) * size, current * size), pageCount };
}

/** Which page numbers to show: the first, the last and the neighbours of the current one, with "…" for the gaps. */
export function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const pages = [...wanted].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  pages.forEach((n, i) => {
    const previous = pages[i - 1];
    if (previous !== undefined && n - previous > 1) result.push(n - previous === 2 ? n - 1 : "…");
    result.push(n);
  });
  return result;
}
