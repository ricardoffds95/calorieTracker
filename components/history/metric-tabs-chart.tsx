"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { MetricChart } from "@/components/history/metric-chart";
import { METRICS, bucketLabel, dayLabel, macroSplit, type Bucket, type Metric, type PeriodKind, type PeriodSummary } from "@/lib/history";
import { cn } from "@/lib/utils";

const TEXT: Record<Metric, string> = { calories: "text-primary", protein: "text-protein", carbs: "text-carbs", fat: "text-fat" };
const DOT: Record<Metric, string> = { calories: "bg-primary", protein: "bg-protein", carbs: "bg-carbs", fat: "bg-fat" };

interface MetricTabsChartProps {
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

/** One chart for calories and the three macros (pick one with the tabs), with its average, highest and lowest day below. */
export function MetricTabsChart({ summary, buckets, kind }: MetricTabsChartProps) {
  const [metric, setMetric] = useState<Metric>("calories");
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = buckets.find((b) => b.key === selected) ?? null;
  if (!summary.stats || !summary.average) return null;
  const { label, unit } = METRICS.find((m) => m.key === metric)!;
  const stats = summary.stats[metric];
  const split = macroSplit(summary.average);
  const boxes = [
    { key: "avg", name: "Avg", icon: null, value: stats.average, day: null },
    { key: "max", name: "Max", icon: ArrowUp, value: stats.max.value, day: stats.max.date },
    { key: "min", name: "Min", icon: ArrowDown, value: stats.min.value, day: stats.min.date },
  ] as const;

  return (
    <section aria-label="Chart" className="flex flex-col gap-3">
      <div role="group" aria-label="Metric" className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={metric === m.key}
            data-testid={`metric-tab-${m.key}`}
            onClick={() => setMetric(m.key)}
            className="flex h-10 items-center justify-center gap-1.5 rounded-sm px-1 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:text-foreground dark:aria-pressed:bg-background"
          >
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[m.key])} />
            {m.label}
          </button>
        ))}
      </div>

      <p aria-live="polite" data-testid="chart-readout" className="min-h-5 text-sm text-muted-foreground tabular-nums">
        {chosen ? readout(chosen) : "Tap a bar"}
      </p>

      <div data-testid={`metric-${metric}`}>
        <MetricChart metric={metric} label={label} unit={unit} buckets={buckets} kind={kind} selected={selected} onSelect={setSelected} accessible tall />
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {boxes.map((box) => (
          <div key={box.key} className="flex min-w-0 flex-col gap-0.5 rounded-md bg-muted px-3 py-2">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              {box.icon && <box.icon aria-hidden className={cn("size-3", TEXT[metric])} />}
              {box.name}
            </dt>
            <dd data-testid={`stat-${metric}-${box.key}`} className="min-w-0 tabular-nums">
              <span className={cn("text-xl font-semibold", TEXT[metric])}>{box.value}</span>
              <span className="text-xs text-muted-foreground"> {unit}</span>
              {box.day && <span className="block truncate text-xs text-muted-foreground">{dayLabel(box.day)}</span>}
              {!box.day && metric !== "calories" && <span className="block truncate text-xs text-muted-foreground">{split[metric]}% of kcal</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
