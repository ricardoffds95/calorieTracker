"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ScanBarcode, Search, Sparkles } from "lucide-react";
import { FoodResultRow } from "@/components/log/food-result-row";
import { Pagination } from "@/components/log/pagination";
import { useDebouncedValue } from "@/components/log/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FOOD_SEARCH_MESSAGES,
  FoodSearchError,
  MIN_QUERY_LENGTH,
  normalizeQuery,
  paginate,
  searchOpenFoodFacts,
  searchSavedFoods,
  type FoodSearchResult,
  type SavedFood,
} from "@/lib/food-search";
import { cn } from "@/lib/utils";

// Open Food Facts allows few searches per minute: ask once the user stopped typing, or on "Pesquisar".
const SEARCH_DEBOUNCE_MS = 700;
/** Scrolling this far with the field focused closes the keyboard (otherwise it covers the results). */
const SCROLL_BLUR_PX = 24;

type Source = "saved" | "off";

interface FoodSearchProps {
  saved: readonly SavedFood[];
  onPick: (food: FoodSearchResult) => void;
  onScan: () => void;
  onAi: () => void;
  /** Called when the results start/stop showing, so a dialog can hide the rest of its form meanwhile. */
  onSearchingChange?: (searching: boolean) => void;
  /** Rendered below the field while nothing is being searched (saved lists). */
  children?: ReactNode;
}

export function FoodSearch({ saved, onPick, onScan, onAi, onSearchingChange, children }: FoodSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null); // set by the button / Enter, cleared by typing
  const [focused, setFocused] = useState(false);
  // Page and tab are remembered per search text: a new search starts again at page 1.
  const [view, setView] = useState<{ term: string; source?: Source; savedPage: number; offPage: number }>({ term: "", savedPage: 1, offPage: 1 });

  const debounced = normalizeQuery(useDebouncedValue(query, SEARCH_DEBOUNCE_MS));
  const term = submitted ?? debounced;
  const searching = term.length >= MIN_QUERY_LENGTH;
  const current = view.term === term ? view : { term, savedPage: 1, offPage: 1 };

  useEffect(() => {
    onSearchingChange?.(searching);
  }, [searching, onSearchingChange]);

  const savedAll = useMemo(() => searchSavedFoods(saved, term), [saved, term]);
  const savedPage = paginate(savedAll, current.savedPage);
  const off = useQuery({
    queryKey: ["off-search", term, current.offPage],
    queryFn: ({ signal }) => searchOpenFoodFacts(term, { page: current.offPage, signal }),
    enabled: searching,
    placeholderData: keepPreviousData,
    // Nothing is cached: every search asks Open Food Facts again.
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    meta: { persist: false },
  });

  const source: Source = current.source ?? (savedAll.length > 0 ? "saved" : "off");
  const update = (patch: Partial<typeof view>) => setView({ ...current, ...patch });

  // Scrolling the results closes the keyboard, so neither it nor the browser bar covers them.
  useEffect(() => {
    if (!focused) return;
    const start = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - start) > SCROLL_BLUR_PX) inputRef.current?.blur();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [focused]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(normalizeQuery(query));
    inputRef.current?.blur(); // closes the keyboard so the results are visible
  }

  const offError = off.error instanceof FoodSearchError ? off.error.message : off.error ? FOOD_SEARCH_MESSAGES.http : null;
  const offTotal = off.data ? `${off.data.total}${off.data.totalExact ? "" : "+"}` : off.isFetching ? "…" : "0";
  const offLoading = off.isFetching && !off.data;

  return (
    <section aria-label="Pesquisar alimento" className="flex flex-col gap-3">
      <form role="search" onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            aria-label="Pesquisar alimento"
            placeholder="Pesquisar alimento"
            enterKeyHint="search"
            autoComplete="off"
            className="h-11 pl-9"
            value={query}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              setQuery(e.target.value);
              setSubmitted(null);
            }}
          />
        </div>
        <Button type="submit" className="h-11" disabled={normalizeQuery(query).length < MIN_QUERY_LENGTH}>
          Pesquisar
        </Button>
      </form>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={onScan}>
          <ScanBarcode aria-hidden />
          Código de barras
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={onAi}>
          <Sparkles aria-hidden />
          Com IA
        </Button>
      </div>

      {searching ? (
        <div className="flex flex-col gap-2" data-testid="search-results">
          <div role="group" aria-label="Fonte dos resultados" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            {(
              [
                ["saved", `Guardados · ${savedAll.length}`],
                ["off", `Open Food Facts · ${offTotal}`],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant="ghost"
                aria-pressed={source === key}
                className="h-10 px-1 text-xs text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground dark:aria-pressed:bg-background"
                onClick={() => update({ source: key })}
              >
                {label}
              </Button>
            ))}
          </div>

          {source === "saved" ? (
            <>
              {savedPage.items.length > 0 ? (
                <ul className="flex flex-col">
                  {savedPage.items.map((food) => (
                    <FoodResultRow key={food.id} food={food} onPick={onPick} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum dos teus guardados tem esse nome.</p>
              )}
              <Pagination page={current.savedPage} pageCount={savedPage.pageCount} onChange={(page) => update({ savedPage: page })} />
            </>
          ) : (
            <div className={cn("flex flex-col gap-1 transition-opacity", off.isPlaceholderData && "opacity-60")}>
              {offLoading && (
                <div aria-label="A pesquisar" className="flex flex-col gap-2">
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                </div>
              )}
              {offError && !off.data && (
                <div className="flex items-center justify-between gap-3">
                  <p role="alert" className="text-sm text-destructive">
                    {offError}
                  </p>
                  <Button type="button" variant="outline" className="h-11 shrink-0" disabled={off.isFetching} onClick={() => void off.refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              )}
              {off.data && off.data.results.length > 0 && (
                <ul className="flex flex-col">
                  {off.data.results.map((food) => (
                    <FoodResultRow key={food.id} food={food} onPick={onPick} />
                  ))}
                </ul>
              )}
              {off.data && off.data.results.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem resultados. Experimenta outro nome ou insere manualmente.</p>
              )}
              {off.data && <Pagination page={current.offPage} pageCount={off.data.pageCount} disabled={off.isFetching} onChange={(page) => update({ offPage: page })} />}
            </div>
          )}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
