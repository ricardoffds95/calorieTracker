"use client";

import { useState } from "react";
import { MetricBlock } from "@/components/history/metric-block";
import { METRICS, bucketLabel, macroSplit, type Bucket, type PeriodKind, type PeriodSummary } from "@/lib/history";

interface PeriodMetricsProps {
  summary: PeriodSummary;
  buckets: readonly Bucket[];
  kind: PeriodKind;
}

function readout(bucket: Bucket): string {
  if (!bucket.average) return `${bucketLabel(bucket)}: none`;
  const { calories, protein, carbs, fat } = bucket.average;
  const per = bucket.granularity === "day" ? "" : " per day";
  return `${bucketLabel(bucket)}: ${calories} kcal${per} · P ${protein} · C ${carbs} · F ${fat}`;
}

/** Calories and the three macros, each with its stats and its chart. Selecting a day in one chart selects it in all. */
export function PeriodMetrics({ summary, buckets, kind }: PeriodMetricsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = buckets.find((b) => b.key === selected) ?? null;
  if (!summary.stats || !summary.average) return null;
  const split = macroSplit(summary.average);

  return (
    <div className="flex flex-col gap-6">
      <p aria-live="polite" data-testid="chart-readout" className="min-h-10 text-sm text-muted-foreground tabular-nums">
        {chosen ? readout(chosen) : "Tap a bar"}
      </p>
      {METRICS.map(({ key, label, unit }) => (
        <MetricBlock
          key={key}
          metric={key}
          label={label}
          unit={unit}
          stats={summary.stats![key]}
          note={key === "calories" ? undefined : `${split[key]}% of kcal`}
          buckets={buckets}
          kind={kind}
          selected={selected}
          onSelect={setSelected}
        />
      ))}
    </div>
  );
}
