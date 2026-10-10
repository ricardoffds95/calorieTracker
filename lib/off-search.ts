import "server-only";
import { isUsable, mapProduct, normalizeQuery, type FoodSearchResult, type OffProduct } from "./food-search";

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
  fetch?: typeof fetch;
  contactEmail?: string;
  sleep?: (ms: number) => Promise<void>;
}

type Attempt = { ok: true; hits: OffProduct[] } | { ok: false; error: OffUnavailableError; retry: boolean };

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
    const data = (await response.json()) as { hits?: OffProduct[] };
    return { ok: true, hits: Array.isArray(data.hits) ? data.hits : [] };
  } catch {
    return { ok: false, error: new OffUnavailableError("server"), retry: true };
  }
}

/**
 * Searches Open Food Facts for `query` (already validated by the caller) and returns usable foods per 100 g.
 * Retries once on timeouts, 429 and 5xx; throws OffUnavailableError when it still cannot answer.
 */
export async function searchOffServer(query: string, options: SearchOptions = {}): Promise<FoodSearchResult[]> {
  const { fetch: fetchFn = fetch, contactEmail, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = options;
  const url = `${SEARCH_URL}?${new URLSearchParams({ q: normalizeQuery(query), page_size: "20", langs: "pt", fields: FIELDS })}`;
  const headers = { "User-Agent": offUserAgent(contactEmail), Accept: "application/json" };

  let last: OffUnavailableError | undefined;
  for (let i = 0; i < ATTEMPTS; i++) {
    if (i > 0) await sleep(RETRY_DELAY_MS);
    const result = await attempt(url, headers, fetchFn);
    if (result.ok) {
      return result.hits
        .filter((product) => product.nutriments)
        .map(mapProduct)
        .filter(isUsable);
    }
    last = result.error;
    if (!result.retry) break;
  }
  throw last ?? new OffUnavailableError("server");
}
