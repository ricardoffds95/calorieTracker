import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";

const KEY_PREFIX = "caltracker-query-cache";

function cacheKey(userId: string) {
  return `${KEY_PREFIX}:${userId}`;
}

/** IndexedDB persister scoped to one user, so cached data never leaks between accounts. */
export function createUserPersister(userId: string): Persister {
  const key = cacheKey(userId);
  return {
    persistClient: (client: PersistedClient) => set(key, client),
    restoreClient: () => get<PersistedClient>(key),
    removeClient: () => del(key),
  };
}

export function clearUserCache(userId: string) {
  return del(cacheKey(userId));
}
