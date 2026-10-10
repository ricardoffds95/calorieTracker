import "server-only";
import { MAX_PAGES, PAGE_SIZE, isUsable, mapProduct, normalizeQuery, type OffProduct, type SearchPage } from "./food-search";

/** Open Food Facts could not answer (down, overloaded, rate limited, timeout) after the retry. */
export class OffUnavailableError extends Error {
  constructor(readonly reason: "timeout" | "network" | "rate_limited" | "server") {
    super(`Open Food Facts unavailable: ${reason}`);
    this.name = "OffUnavailableError";
  }
}

// The newer search API: reliable and fast, but without CORS for our origin, so only the server calls it.
const SEARCH_URL = "https://search.openfoodfacts.org/search";
const FIELDS =
  "code,product_name,product_name_pt,product_name_en,product_name_es,product_name_fr,brands,nutriments,serving_size";
const TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 400;
const ATTEMPTS = 2;

/** Open Food Facts asks every app to identify itself: `AppName/Version (ContactEmail)`. */
export function offUserAgent(contactEmail?: string): string {
  const email = contactEmail?.trim();
  return email ? `CalorieTracker/1.0 (${email})` : "CalorieTracker/1.0";
}

interface SearchOptions {
  /** 1-based page of 20 results. */
  page?: number;
  fetch?: typeof fetch;
  contactEmail?: string;
  sleep?: (ms: number) => Promise<void>;
}

interface OffResponse {
  hits?: OffProduct[];
  count?: number;
  is_count_exact?: boolean;
  page_count?: number;
}

type Attempt = { ok: true; data: OffResponse } | { ok: false; error: OffUnavailableError; retry: boolean };

async function attempt(url: string, headers: HeadersInit, fetchFn: typeof fetch): Promise<Attempt> {
  let response: Response;
  try {
    response = await fetchFn(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return { ok: false, error: new OffUnavailableError(timedOut ? "timeout" : "network"), retry: true };
  }
  if (response.status === 429) return { ok: false, error: new OffUnavailableError("rate_limited"), retry: true };
  // 5xx is retried; any other non-2xx is our own mistake and retrying would not help.
  if (!response.ok) return { ok: false, error: new OffUnavailableError("server"), retry: response.status >= 500 };
  try {
    const data = (await response.json()) as OffResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, error: new OffUnavailableError("server"), retry: true };
  }
}

/**
 * Searches Open Food Facts for `query` (already validated by the caller) and returns one page of usable foods per 100 g.
 * Retries once on timeouts, 429 and 5xx; throws OffUnavailableError when it still cannot answer.
 */
export async function searchOffServer(query: string, options: SearchOptions = {}): Promise<SearchPage> {
  const { page = 1, fetch: fetchFn = fetch, contactEmail, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = options;
  const url = `${SEARCH_URL}?${new URLSearchParams({ q: normalizeQuery(query), page_size: String(PAGE_SIZE), page: String(page), langs: "pt", fields: FIELDS })}`;
  const headers = { "User-Agent": offUserAgent(contactEmail), Accept: "application/json" };

  let last: OffUnavailableError | undefined;
  for (let i = 0; i < ATTEMPTS; i++) {
    if (i > 0) await sleep(RETRY_DELAY_MS);
    const result = await attempt(url, headers, fetchFn);
    if (result.ok) {
      const { hits, count, is_count_exact, page_count } = result.data;
      return {
        results: (Array.isArray(hits) ? hits : [])
          .filter((product) => product.nutriments)
          .map(mapProduct)
          .filter(isUsable),
        page,
        pageCount: Math.min(Math.max(page_count ?? 1, 1), MAX_PAGES),
        total: count ?? 0,
        totalExact: is_count_exact ?? true,
      };
    }
    last = result.error;
    if (!result.retry) break;
  }
  throw last ?? new OffUnavailableError("server");
}
