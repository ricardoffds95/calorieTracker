"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ScanBarcode, Search, Sparkles } from "lucide-react";
import { FoodResultRow } from "@/components/log/food-result-row";
import { Pagination } from "@/components/log/pagination";
import { useDebouncedValue } from "@/components/log/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hint } from "@/components/ui/hint";
import { ScrollList } from "@/components/ui/scroll-list";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FOOD_SEARCH_MESSAGES,
  FoodSearchError,
  MIN_QUERY_LENGTH,
  normalizeQuery,
  paginate,
  searchOpenFoodFacts,
  filterSavedMeals,
  searchSavedFoods,
  type FoodSearchResult,
  type SavedFood,
} from "@/lib/food-search";
import type { SavedMeal } from "@/lib/queries/saved";
import { cn } from "@/lib/utils";

// Open Food Facts allows few searches per minute: ask once the user stopped typing, or on "Pesquisar".
const SEARCH_DEBOUNCE_MS = 700;
/** Scrolling this far with the field focused closes the keyboard (otherwise it covers the results). */
const SCROLL_BLUR_PX = 24;
/** Scrolls this soon after focusing are the browser revealing the field, not the user. */
const SCROLL_ARM_MS = 500;

type Source = "saved" | "off";

interface FoodSearchProps {
  saved: readonly SavedFood[];
  onPick: (food: FoodSearchResult) => void;
  onScan: () => void;
  onAi: () => void;
  /**
   * "meals": only the saved meals are searched (a meal is a set of foods: no Open Food Facts, no barcode) or the AI is used.
   * Needs `meals` and `onPickMeal`.
   */
  kind?: "foods" | "meals";
  meals?: readonly SavedMeal[];
  onPickMeal?: (meal: SavedMeal) => void;
  /** Called when the results start/stop showing, so a dialog can hide the rest of its form meanwhile. */
  onSearchingChange?: (searching: boolean) => void;
  /** Rendered below the field while nothing is being searched (saved lists). */
  children?: ReactNode;
}

export function FoodSearch({ saved, onPick, onScan, onAi, kind = "foods", meals = [], onPickMeal, onSearchingChange, children }: FoodSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null); // set by the button / Enter, cleared by typing
  const [focused, setFocused] = useState(false);
  // Page and tab are remembered per search text: a new search starts again at page 1.
  const [view, setView] = useState<{ term: string; source?: Source; savedPage: number; offPage: number }>({ term: "", savedPage: 1, offPage: 1 });

  const debounced = normalizeQuery(useDebouncedValue(query, SEARCH_DEBOUNCE_MS));
  // Saved meals are searched on the device: no pause needed.
  const term = kind === "meals" ? normalizeQuery(query) : (submitted ?? debounced);
  const searching = term.length >= MIN_QUERY_LENGTH;
  const current = view.term === term ? view : { term, savedPage: 1, offPage: 1 };

  // A search running (pause in typing, button, Enter) closes the keyboard so the results are visible.
  useEffect(() => {
    if (searching) inputRef.current?.blur();
  }, [term, searching]);

  useEffect(() => {
    onSearchingChange?.(searching);
  }, [searching, onSearchingChange]);

  const savedAll = useMemo(() => searchSavedFoods(saved, term), [saved, term]);
  const savedPage = paginate(savedAll, current.savedPage);
  const mealsAll = useMemo(() => (kind === "meals" ? filterSavedMeals(meals, term) : []), [kind, meals, term]);
  const mealsPage = paginate(mealsAll, current.savedPage);
  const off = useQuery({
    queryKey: ["off-search", term, current.offPage],
    queryFn: ({ signal }) => searchOpenFoodFacts(term, { page: current.offPage, signal }),
    enabled: searching && kind === "foods",
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

  // Scrolling the results closes the keyboard, so neither it nor the browser bar covers them. The first moments after
  // focusing are ignored: iOS itself scrolls the page (or the dialog) to reveal the field, which would close the keyboard
  // as soon as it opened. Any scroller counts (the page, or the dialog the search sits in).
  useEffect(() => {
    if (!focused) return;
    const starts = new Map<EventTarget, number>();
    const position = (target: EventTarget) => (target instanceof Element ? target.scrollTop : window.scrollY);
    const onScroll = (event: Event) => {
      const target = event.target === document ? window : (event.target ?? window);
      const now = position(target);
      // a list that was not around the field when focusing starts at its top
      if (Math.abs(now - (starts.get(target) ?? 0)) > SCROLL_BLUR_PX) inputRef.current?.blur();
    };
    const arm = window.setTimeout(() => {
      // Where every scroller around the field is now: scrolling is measured from here.
      starts.set(window, window.scrollY);
      for (let el = inputRef.current?.parentElement; el; el = el.parentElement) starts.set(el, el.scrollTop);
      document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    }, SCROLL_ARM_MS);
    return () => {
      window.clearTimeout(arm);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
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
    <section aria-label={kind === "meals" ? "Pesquisar refeição" : "Pesquisar alimento"} className="flex flex-col gap-3">
      <form role="search" onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            aria-label={kind === "meals" ? "Pesquisar refeição" : "Pesquisar alimento"}
            placeholder={kind === "meals" ? "Pesquisar refeição" : "Pesquisar alimento"}
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
        {kind === "foods" && (
          <Button type="submit" className="h-11" disabled={normalizeQuery(query).length < MIN_QUERY_LENGTH}>
            Pesquisar
          </Button>
        )}
      </form>
      <div className={cn("grid gap-2", kind === "foods" && "grid-cols-2")}>
        {kind === "foods" && (
          <Button type="button" variant="outline" className="h-11" onClick={onScan}>
            <ScanBarcode aria-hidden />
            Código de barras
          </Button>
        )}
        <Button type="button" variant="outline" className="h-11" onClick={onAi}>
          <Sparkles aria-hidden />
          Com IA
        </Button>
      </div>

      {query.trim().length > 0 && normalizeQuery(query).length < MIN_QUERY_LENGTH && <Hint>Escreve pelo menos {MIN_QUERY_LENGTH} letras para pesquisar.</Hint>}

      {searching && kind === "meals" ? (
        <div className="flex flex-col gap-2" data-testid="search-results">
          {mealsPage.items.length > 0 ? (
            <ScrollList aria-label="Refeições encontradas">
              <ul className="flex flex-col">
                {mealsPage.items.map((meal) => (
                  <li key={meal.id}>
                    <button
                      type="button"
                      aria-label={`Escolher ${meal.name}`}
                      onClick={() => onPickMeal?.(meal)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm px-1 py-1.5 text-left"
                    >
                      <span className="min-w-0 truncate">{meal.name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{meal.total_calories} kcal</span>
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollList>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma das tuas refeições tem esse nome. Cria uma ou usa a IA.</p>
          )}
          <Pagination page={current.savedPage} pageCount={mealsPage.pageCount} onChange={(page) => update({ savedPage: page })} />
        </div>
      ) : searching ? (
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
                <ScrollList aria-label="Resultados da pesquisa">
                  <ul className="flex flex-col">
                    {savedPage.items.map((food) => (
                      <FoodResultRow key={food.id} food={food} onPick={onPick} />
                    ))}
                  </ul>
                </ScrollList>
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
                <ScrollList aria-label="Resultados do Open Food Facts">
                  <ul className="flex flex-col">
                    {off.data.results.map((food) => (
                      <FoodResultRow key={food.id} food={food} onPick={onPick} />
                    ))}
                  </ul>
                </ScrollList>
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
