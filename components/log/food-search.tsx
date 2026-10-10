"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ScanBarcode, Search, Sparkles } from "lucide-react";
import { FoodResultRow } from "@/components/log/food-result-row";
import { useDebouncedValue } from "@/components/log/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createIdbSearchCache } from "@/lib/food-search-cache";
import {
  FOOD_SEARCH_MESSAGES,
  FoodSearchError,
  MIN_QUERY_LENGTH,
  OFF_MIN_QUERY_LENGTH,
  mergeResults,
  normalizeQuery,
  peekOffCache,
  searchOpenFoodFacts,
  searchSavedFoods,
  shouldSearchOnline,
  type FoodSearchResult,
  type SavedFood,
} from "@/lib/food-search";

// Open Food Facts allows few searches per minute: only ask once the user has really stopped typing.
const SEARCH_DEBOUNCE_MS = 600;
const searchCache = typeof window === "undefined" ? undefined : createIdbSearchCache();

interface FoodSearchProps {
  saved: readonly SavedFood[];
  onPick: (food: FoodSearchResult) => void;
  onScan: () => void;
  onAi: () => void;
  /** Rendered below the field while nothing is being searched (saved lists). */
  children?: React.ReactNode;
}

export function FoodSearch({ saved, onPick, onScan, onAi, children }: FoodSearchProps) {
  const [query, setQuery] = useState("");
  // The user asked for Open Food Facts even though saved foods already match.
  const [forced, setForced] = useState(false);
  const debounced = normalizeQuery(useDebouncedValue(query, SEARCH_DEBOUNCE_MS));
  const typed = normalizeQuery(query);
  const searching = typed.length >= MIN_QUERY_LENGTH;
  const online = typed.length >= OFF_MIN_QUERY_LENGTH;

  const savedMatches = useMemo(() => searchSavedFoods(saved, query), [saved, query]);
  // Cache first: results of past searches cost no request, so they are shown right away with the saved foods.
  const cached = useQuery({
    queryKey: ["off-cache", typed],
    queryFn: async () => (await peekOffCache(typed, { cache: searchCache })) ?? [],
    enabled: online,
    placeholderData: keepPreviousData, // no flicker while the cache reads the new text
    // Re-read whenever this text is typed again: an online search may have written the cache since.
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    meta: { persist: false },
  });
  const cacheRead = cached.isSuccess && !cached.isPlaceholderData;
  const cachedResults = online ? (cached.data ?? []) : [];
  // Open Food Facts is only asked on request, or when neither the saved foods nor the cache have anything.
  const useOff =
    online && shouldSearchOnline({ forced, cacheRead, savedCount: savedMatches.length, cachedCount: cachedResults.length });
  const off = useQuery({
    queryKey: ["off-search", debounced, forced],
    queryFn: ({ signal }) => searchOpenFoodFacts(debounced, { signal, cache: searchCache, refresh: forced }),
    enabled: useOff && debounced.length >= OFF_MIN_QUERY_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 5,
    retry: false,
    meta: { persist: false }, // has its own 30-day IndexedDB cache
  });

  const results = mergeResults(savedMatches, useOff ? (off.data?.results ?? []) : cachedResults);
  const waiting = (online && !cacheRead && savedMatches.length === 0) || (useOff && (debounced !== typed || off.isFetching));
  const error = !useOff ? null : off.error instanceof FoodSearchError ? off.error.message : off.error ? FOOD_SEARCH_MESSAGES.http : null;

  return (
    <section aria-label="Pesquisar alimento" className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Pesquisar alimento"
            placeholder="Pesquisar alimento"
            enterKeyHint="search"
            autoComplete="off"
            className="h-11 pl-9"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setForced(false);
            }}
          />
        </div>
        <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Ler código de barras" onClick={onScan}>
          <ScanBarcode aria-hidden />
        </Button>
        <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Registar com IA" onClick={onAi}>
          <Sparkles aria-hidden />
        </Button>
      </div>

      {searching ? (
        <div className="flex flex-col gap-1" data-testid="search-results">
          {results.length > 0 && (
            <ul className="flex flex-col">
              {results.map((food) => (
                <FoodResultRow key={`${food.source}-${food.id}`} food={food} onPick={onPick} />
              ))}
            </ul>
          )}
          {waiting && (
            <div aria-label="A pesquisar" className="flex flex-col gap-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-between gap-3">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              <Button type="button" variant="outline" className="h-11 shrink-0" disabled={off.isFetching} onClick={() => void off.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}
          {!online && (
            <p className="text-sm text-muted-foreground">Escreve pelo menos {OFF_MIN_QUERY_LENGTH} letras para pesquisar também no Open Food Facts.</p>
          )}
          {online && !useOff && cacheRead && (
            <Button type="button" variant="outline" className="h-11" onClick={() => setForced(true)}>
              Pesquisar no Open Food Facts
            </Button>
          )}
          {useOff && !waiting && !error && results.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem resultados. Experimenta outro nome ou insere manualmente.</p>
          )}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
