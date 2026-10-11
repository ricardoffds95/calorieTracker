"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTopItems, type TopOrder } from "@/lib/queries/history";
import { cn } from "@/lib/utils";

const TABS: readonly { key: TopOrder; label: string }[] = [
  { key: "times", label: "Times" },
  { key: "calories", label: "Calories" },
];

/** The foods and meals eaten most: by how many times, or by the calories they add up to. */
export function TopItems({ userId, from, to }: { userId: string; from: string; to: string }) {
  const [order, setOrder] = useState<TopOrder>("times");
  const items = useTopItems(userId, from, to, order);

  return (
    <section aria-label="Most eaten" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Most eaten</h2>
        <div role="group" aria-label="Order" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={order === tab.key}
              onClick={() => setOrder(tab.key)}
              className="h-8 rounded-sm px-3 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:text-foreground dark:aria-pressed:bg-background"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {items.isPending && <Skeleton className="h-40 w-full" aria-label="Loading" />}
      {items.isError && !items.data && (
        <p role="alert" className="text-sm text-destructive">
          Couldn’t load
        </p>
      )}
      {items.data && (
        <ol data-testid="top-items" className={cn("flex flex-col transition-opacity", items.isPlaceholderData && "opacity-60")}>
          {items.data.map((item, i) => (
            <li key={`${item.kind}-${item.name}`} className="flex min-h-12 items-center gap-3 border-t border-border py-1.5 first:border-t-0">
              <span aria-hidden className="w-4 shrink-0 text-center text-sm text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 break-words">{item.name}</span>
                {item.kind === "meal" && <span className="text-xs text-muted-foreground">Meal</span>}
              </span>
              <span className="shrink-0 text-right text-sm tabular-nums">
                <span data-testid="top-times">{item.times}×</span>
                <span className="block text-xs text-muted-foreground" data-testid="top-calories">
                  {item.totalCalories} kcal
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
