"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { mealShares, type MealKey } from "@/lib/history";
import { useMealTotals } from "@/lib/queries/history";
import { mealLabel } from "@/lib/today";
import { cn } from "@/lib/utils";

/** Four tones that are not the macro colors (a meal is not a macro), always named in the legend. */
const TONE: Record<MealKey, string> = { breakfast: "bg-sky-500", lunch: "bg-indigo-500", dinner: "bg-violet-500", snacks: "bg-slate-400" };

/** Where the calories come from: one bar split between breakfast, lunch, dinner and snacks. */
export function MealSplit({ userId, from, to, loggedDays }: { userId: string; from: string; to: string; loggedDays: number }) {
  const totals = useMealTotals(userId, from, to);
  const shares = totals.data ? mealShares(totals.data, loggedDays) : null;

  return (
    <section aria-label="Calories by meal" className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Calories by meal</h2>
      {totals.isPending && <Skeleton className="h-20 w-full" aria-label="Loading" />}
      {totals.isError && !totals.data && (
        <p role="alert" className="text-sm text-destructive">
          Couldn’t load
        </p>
      )}
      {shares && (
        <>
          <div role="img" aria-label={shares.map((s) => `${mealLabel(s.meal)} ${s.percent}%`).join(", ")} className="flex h-4 overflow-hidden rounded-full bg-muted" data-testid="meal-bar">
            {shares
              .filter((s) => s.percent > 0)
              .map((s) => (
                <span key={s.meal} className={cn("h-full", TONE[s.meal])} style={{ width: `${s.percent}%` }} />
              ))}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2" data-testid="meal-legend">
            {shares.map((s) => (
              <div key={s.meal} className="flex min-w-0 items-center gap-2">
                <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", TONE[s.meal])} />
                <div className="min-w-0 text-sm">
                  <dt className="truncate">
                    {mealLabel(s.meal)} <span data-testid={`meal-percent-${s.meal}`} className="tabular-nums text-muted-foreground">{s.percent}%</span>
                  </dt>
                  <dd className="text-xs text-muted-foreground tabular-nums">{s.perDay} kcal/day</dd>
                </div>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
