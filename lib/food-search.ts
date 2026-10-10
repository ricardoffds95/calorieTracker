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
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, unknown>;
}

export class FoodSearchError extends Error {
  constructor(message: string, readonly kind: "network" | "http" | "timeout") {
    super(message);
    this.name = "FoodSearchError";
  }
}

/** Local (browser) cache of OFF searches. Never shared between users. */
export interface SearchCacheEntry {
  results: FoodSearchResult[];
  timestamp: number;
}
export interface SearchCache {
  get(key: string): Promise<SearchCacheEntry | undefined>;
  set(key: string, entry: SearchCacheEntry): Promise<void>;
}

export const SEARCH_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const MIN_QUERY_LENGTH = 2;

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

  const kj = pick(nutriments, "energy_100g");
  const kcal = pick(nutriments, "energy-kcal_100g", "energy-kcal") ?? (kj !== undefined ? kj / 4.184 : 0);

  return {
    id: product.code ?? "",
    source: "off",
    name,
    brand: product.brands?.trim() || undefined,
    off_code: product.code,
    calories_100g: roundCalories(kcal),
    protein_100g: roundMacro(pick(nutriments, "proteins_100g", "protein_100g", "proteins") ?? 0),
    carbs_100g: roundMacro(pick(nutriments, "carbohydrates_100g", "carbohydrates") ?? 0),
    fat_100g: roundMacro(pick(nutriments, "fat_100g", "fat") ?? 0),
    serving_size: product.serving_size?.trim() || undefined,
  };
}

/** Products without a name or without any energy are not useful to log. */
function isUsable(result: FoodSearchResult): boolean {
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
    if (timeout.aborted) throw new FoodSearchError("A pesquisa demorou demasiado. Tenta novamente.", "timeout");
    throw new FoodSearchError("Sem ligação. Verifica a internet e tenta novamente.", "network");
  }
  if (!response.ok) throw new FoodSearchError(`Erro ao pesquisar alimento (${response.status}).`, "http");
  return response.json();
}

export interface SearchOffOptions extends FetchOptions {
  cache?: SearchCache;
  now?: () => number;
  ttlMs?: number;
}

export async function searchOpenFoodFacts(
  query: string,
  options: SearchOffOptions = {},
): Promise<{ results: FoodSearchResult[]; fromCache: boolean }> {
  const normalized = normalizeQuery(query);
  if (normalized.length < MIN_QUERY_LENGTH) return { results: [], fromCache: false };

  const { cache, now = Date.now, ttlMs = SEARCH_CACHE_TTL_MS } = options;
  const cached = await cache?.get(normalized);
  if (cached && now() - cached.timestamp < ttlMs) return { results: cached.results, fromCache: true };

  const url =
    "https://world.openfoodfacts.org/cgi/search.pl?" +
    new URLSearchParams({
      search_terms: normalized,
      search_simple: "1",
      action: "process",
      json: "1",
      fields: OFF_FIELDS,
      lc: "pt",
      page_size: "20",
    });
  const data = (await getJson(url, options, 15_000)) as { products?: OffProduct[] };

  const results = (data.products ?? [])
    .filter((p) => p.nutriments)
    .map(mapProduct)
    .filter(isUsable);

  await cache?.set(normalized, { results, timestamp: now() });
  return { results, fromCache: false };
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

function savedToResult(food: SavedFood): FoodSearchResult {
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

/** Instant, local search over the user's saved foods: prefix matches first, then most used. */
export function searchSavedFoods(saved: readonly SavedFood[], query: string): FoodSearchResult[] {
  const needle = fold(normalizeQuery(query));
  if (needle.length === 0) return [];
  return saved
    .filter((f) => fold(`${f.name} ${f.brand ?? ""}`).includes(needle))
    .sort((a, b) => {
      const aPrefix = fold(a.name).startsWith(needle) ? 0 : 1;
      const bPrefix = fold(b.name).startsWith(needle) ? 0 : 1;
      return aPrefix - bPrefix || b.times_used - a.times_used || a.name.localeCompare(b.name, "pt");
    })
    .map(savedToResult);
}

/** Saved foods first; OFF results that duplicate a saved food (same barcode or name) are dropped. */
export function mergeResults(saved: readonly FoodSearchResult[], off: readonly FoodSearchResult[]): FoodSearchResult[] {
  const codes = new Set(saved.flatMap((s) => (s.off_code ? [s.off_code] : [])));
  const names = new Set(saved.map((s) => fold(s.name.trim())));
  const rest = off.filter((o) => !(o.off_code && codes.has(o.off_code)) && !names.has(fold(o.name.trim())));
  return [...saved, ...rest];
}
