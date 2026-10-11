"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DaysSection } from "@/components/history/days-section";
import { MealSplit } from "@/components/history/meal-split";
import { MetricTabsChart } from "@/components/history/metric-tabs-chart";
import { PeriodPicker } from "@/components/history/period-picker";
import { PeriodSummaryCard } from "@/components/history/period-summary";
import { TopItems } from "@/components/history/top-items";
import { Hint } from "@/components/ui/hint";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMounted } from "@/components/use-mounted";
import { toDateKey } from "@/lib/dates";
import { bucketize, parsePeriodParams, percentChange, previousPeriod, summarize } from "@/lib/history";
import { useHistory } from "@/lib/queries/history";
import { cn } from "@/lib/utils";

/** Fewer logged days than this and there is no trend to talk about. */
const MIN_DAYS_FOR_TRENDS = 3;

export function HistoryScreen({ userId }: { userId: string }) {
  // "Current week" depends on the browser's clock, so nothing date-based renders on the server.
  if (!useMounted()) return <Skeleton className="h-96 w-full" aria-label="Loading" />;
  return <HistoryPeriod userId={userId} />;
}

function HistoryPeriod({ userId }: { userId: string }) {
  const [now] = useState(() => new Date());
  const params = useSearchParams();
  const period = useMemo(() => parsePeriodParams(params, now), [params, now]);
  const history = useHistory(userId, period.from, period.to);

  const days = useMemo(() => history.data ?? [], [history.data]);
  const summary = useMemo(() => summarize(days, period, toDateKey(now)), [days, period, now]);
  const todayKey = toDateKey(now);
  const buckets = useMemo(() => bucketize(days, period, todayKey), [days, period, todayKey]);

  // the period right before, to say whether the average went up or down (only worth it with a few days to compare)
  const before = useMemo(() => previousPeriod(period), [period]);
  const beforeHistory = useHistory(userId, before.from, before.to);
  const beforeAverage = useMemo(() => (beforeHistory.data ? summarize(beforeHistory.data, before, todayKey).average : null), [beforeHistory.data, before, todayKey]);
  const enoughDays = summary.loggedDays >= MIN_DAYS_FOR_TRENDS;
  const delta = summary.average && enoughDays ? percentChange(summary.average.calories, beforeAverage?.calories) : null;
  return (
    <div className="flex flex-col gap-6">
      <PeriodPicker period={period} now={now} />

      {history.isError && !history.data && (
        <div className="flex items-center justify-between gap-3">
          <p role="alert" className="text-sm text-destructive">
            Couldn’t load history
          </p>
          <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => void history.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {history.isPending && <Skeleton className="h-96 w-full" aria-label="Loading history" />}

      {history.data && (
        // While the next period loads the previous one stays on screen, dimmed: no skeleton, no layout jump.
        <div className={cn("flex flex-col gap-6 transition-opacity", history.isPlaceholderData && "opacity-60")} aria-busy={history.isPlaceholderData}>
          <PeriodSummaryCard summary={summary} kind={period.kind} delta={delta} />
          {summary.average && (
            <>
              <MetricTabsChart key={`${period.kind}-${period.from}-${period.to}`} summary={summary} buckets={buckets} kind={period.kind} />
              {!enoughDays && <Hint>Log {MIN_DAYS_FOR_TRENDS}+ days for trends</Hint>}
              <MealSplit userId={userId} from={period.from} to={period.to} loggedDays={summary.loggedDays} />
              <TopItems userId={userId} from={period.from} to={period.to} />
              <DaysSection buckets={buckets} now={now} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
