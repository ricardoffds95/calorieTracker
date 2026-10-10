"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BucketList } from "@/components/history/bucket-list";
import { KcalChart } from "@/components/history/kcal-chart";
import { MacroAverages } from "@/components/history/macro-averages";
import { PeriodPicker } from "@/components/history/period-picker";
import { PeriodSummaryCard } from "@/components/history/period-summary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMounted } from "@/components/use-mounted";
import { toDateKey } from "@/lib/dates";
import { bucketize, parsePeriodParams, summarize } from "@/lib/history";
import { useHistory } from "@/lib/queries/history";
import { cn } from "@/lib/utils";

export function HistoryScreen({ userId }: { userId: string }) {
  // "Current week" depends on the browser's clock, so nothing date-based renders on the server.
  if (!useMounted()) return <Skeleton className="h-96 w-full" aria-label="A carregar" />;
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
  return (
    <div className="flex flex-col gap-6">
      <PeriodPicker period={period} now={now} />

      {history.isError && !history.data && (
        <div className="flex items-center justify-between gap-3">
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar o histórico.
          </p>
          <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => void history.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {history.isPending && <Skeleton className="h-96 w-full" aria-label="A carregar histórico" />}

      {history.data && (
        // While the next period loads the previous one stays on screen, dimmed: no skeleton, no layout jump.
        <div className={cn("flex flex-col gap-6 transition-opacity", history.isPlaceholderData && "opacity-60")} aria-busy={history.isPlaceholderData}>
          <PeriodSummaryCard summary={summary} />
          {summary.average && (
            <>
              <MacroAverages average={summary.average} />
              <KcalChart key={`${period.kind}-${period.from}-${period.to}`} buckets={buckets} kind={period.kind} />
              <BucketList buckets={buckets} now={now} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
