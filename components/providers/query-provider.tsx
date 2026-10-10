"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider, type Query } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { CACHE_MAX_AGE_MS, makeQueryClient } from "@/lib/query/client";
import { createUserPersister } from "@/lib/query/persister";

// Bump when the shape of cached data changes, to discard incompatible caches.
const CACHE_BUSTER = "v1";

export function QueryProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  // Must be referentially stable: the provider re-runs the restore whenever this changes.
  const [persistOptions] = useState(() =>
    userId
      ? {
          persister: createUserPersister(userId),
          maxAge: CACHE_MAX_AGE_MS,
          buster: CACHE_BUSTER,
          // A failed refetch (offline) leaves status "error" but keeps the data: keep persisting it,
          // otherwise going offline would wipe the persisted cache.
          dehydrateOptions: { shouldDehydrateQuery: (query: Query) => query.state.data !== undefined },
        }
      : null,
  );

  if (!persistOptions) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
