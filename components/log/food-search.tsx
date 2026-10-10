"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScanBarcode, Search, Sparkles } from "lucide-react";
import { FoodResultRow } from "@/components/log/food-result-row";
import { useDebouncedValue } from "@/components/log/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createIdbSearchCache } from "@/lib/food-search-cache";
import {
  FoodSearchError,
  MIN_QUERY_LENGTH,
  mergeResults,
  normalizeQuery,
  searchOpenFoodFacts,
  searchSavedFoods,
  type FoodSearchResult,
  type SavedFood,
} from "@/lib/food-search";

const SEARCH_DEBOUNCE_MS = 500;
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
  const debounced = normalizeQuery(useDebouncedValue(query, SEARCH_DEBOUNCE_MS));
  const searching = normalizeQuery(query).length >= MIN_QUERY_LENGTH;

  const savedMatches = useMemo(() => searchSavedFoods(saved, query), [saved, query]);
  const off = useQuery({
    queryKey: ["off-search", debounced],
    queryFn: ({ signal }) => searchOpenFoodFacts(debounced, { signal, cache: searchCache }),
    enabled: searching && debounced.length >= MIN_QUERY_LENGTH,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 5,
    retry: false,
    meta: { persist: false }, // has its own 30-day IndexedDB cache
  });

  const results = mergeResults(savedMatches, off.data?.results ?? []);
  const waiting = searching && (debounced !== normalizeQuery(query) || off.isFetching);
  const error = off.error instanceof FoodSearchError ? off.error.message : off.error ? "Erro ao pesquisar. Tenta novamente." : null;

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
            onChange={(e) => setQuery(e.target.value)}
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
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {!waiting && !error && results.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem resultados. Experimenta outro nome ou insere manualmente.</p>
          )}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
