import { del, get, set } from "idb-keyval";
import { SEARCH_CACHE_TTL_MS, type SearchCache, type SearchCacheEntry } from "./food-search";

const PREFIX = "caltracker-food-search:";

/** Browser-only cache (IndexedDB). Search results are public data, so it is not scoped per user. */
export function createIdbSearchCache(): SearchCache {
  return {
    async get(key) {
      const entry = await get<SearchCacheEntry>(PREFIX + key);
      if (entry && Date.now() - entry.timestamp >= SEARCH_CACHE_TTL_MS) {
        await del(PREFIX + key);
        return undefined;
      }
      return entry;
    },
    async set(key, entry) {
      await set(PREFIX + key, entry);
    },
  };
}
