import { QueryClient } from "@tanstack/react-query";

/** How long cached data is kept in the browser. DB stays the source of truth. */
export const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Show cached data immediately, then revalidate against the DB.
        staleTime: 1000 * 30,
        // Not CACHE_MAX_AGE_MS: gcTime above 2^31-1 ms (~24.8 days) overflows setTimeout and
        // garbage-collects restored queries immediately. Persisted entries expire via maxAge.
        gcTime: Infinity,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}
