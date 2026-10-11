"use client";

import { axisLabel, niceMax, valueOf, type Bucket, type Metric, type PeriodKind } from "@/lib/history";
import { cn } from "@/lib/utils";

/** Token classes for the marks: calories use the accent, every macro its own data color. */
const BAR: Record<Metric, string> = { calories: "bg-primary", protein: "bg-protein", carbs: "bg-carbs", fat: "bg-fat" };

interface MetricChartProps {
  metric: Metric;
  label: string;
  unit: string;
  buckets: readonly Bucket[];
  kind: PeriodKind;
  /** The selected bar (a bucket key), shared by the four charts. */
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** Only the calorie chart is reachable by keyboard/screen reader: the list below has every value of every metric. */
  accessible?: boolean;
  tall?: boolean;
}

/** Average per bar (one bar = a day, a week or a month) of one metric. Tapping a bar selects that day in every chart. */
export function MetricChart({ metric, label, unit, buckets, kind, selected, onSelect, accessible = false, tall = false }: MetricChartProps) {
  const top = niceMax(Math.max(0, ...buckets.map((b) => valueOf(b, metric) ?? 0)) * 1.05);

  return (
    <div className="flex gap-2" role={accessible ? "group" : undefined} aria-label={accessible ? `${label} per logged day` : undefined} aria-hidden={accessible ? undefined : true}>
      <div aria-hidden className={cn("flex w-9 shrink-0 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums", tall ? "h-40" : "h-28")}>
        <span>{top}</span>
        <span>0</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("relative border-b border-border", tall ? "h-40" : "h-28")}>
          <div className="absolute inset-0 flex items-end">
            {buckets.map((bucket) => {
              const value = valueOf(bucket, metric) ?? 0;
              return (
                <button
                  key={bucket.key}
                  type="button"
                  tabIndex={accessible ? 0 : -1}
                  aria-label={accessible ? `${label}: ${value > 0 ? `${value} ${unit}` : "none"}` : undefined}
                  aria-pressed={accessible ? selected === bucket.key : undefined}
                  data-testid={metric === "calories" ? "kcal-bar" : "macro-bar"}
                  data-metric={metric}
                  data-selected={selected === bucket.key}
                  onClick={() => onSelect(selected === bucket.key ? null : bucket.key)}
                  // the whole slot is the hit target (bigger than the bar), with a 1px gap each side
                  className="group flex h-full min-w-0 flex-1 items-end justify-center px-px outline-none"
                >
                  {value > 0 && (
                    <span
                      className={cn(
                        "w-full max-w-6 rounded-t-xs transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                        BAR[metric],
                        selected !== null && selected !== bucket.key && "opacity-50",
                      )}
                      style={{ height: `${Math.max((value / top) * 100, 2)}%` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div aria-hidden className="flex pt-1">
          {buckets.map((bucket, i) => (
            <span key={bucket.key} className="min-w-0 flex-1 text-center text-xs text-muted-foreground">
              {axisLabel(bucket, i, buckets.length, kind)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
