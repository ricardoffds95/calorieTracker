"use client";

import { useState } from "react";
import { axisLabel, bucketLabel, type Bucket, type PeriodKind } from "@/lib/history";
import { cn } from "@/lib/utils";

interface KcalChartProps {
  buckets: readonly Bucket[];
  kind: PeriodKind;
}

const STEP = 500;

/** Round up to a clean axis maximum: 1500, 2500, 3000... */
function niceMax(value: number): number {
  return Math.max(STEP, Math.ceil(value / STEP) * STEP);
}

function readout(bucket: Bucket): string {
  if (!bucket.average) return `${bucketLabel(bucket)}: sem registos`;
  const { calories, protein, carbs, fat } = bucket.average;
  const per = bucket.granularity === "day" ? "" : " por dia";
  return `${bucketLabel(bucket)}: ${calories} kcal${per} · P ${protein} · H ${carbs} · G ${fat}`;
}

/** Average kcal per bar (one bar = a day, a week or a month). Each bar is a button: tap to read the values. */
export function KcalChart({ buckets, kind }: KcalChartProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const top = niceMax(Math.max(0, ...buckets.map((b) => b.average?.calories ?? 0)) * 1.05);
  const chosen = buckets.find((b) => b.key === selected) ?? null;

  return (
    <figure className="flex flex-col gap-2" aria-label="Calorias por dia registado">
      <p aria-live="polite" data-testid="chart-readout" className="min-h-10 text-sm text-muted-foreground tabular-nums">
        {chosen ? readout(chosen) : "Toca numa barra para ver os valores."}
      </p>
      <div className="flex gap-2">
        <div aria-hidden className="flex h-40 w-9 shrink-0 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums">
          <span>{top}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-40 border-b border-border">
            <div role="group" aria-label="Barras" className="absolute inset-0 flex items-end">
              {buckets.map((bucket) => {
                const kcal = bucket.average?.calories ?? 0;
                return (
                  <button
                    key={bucket.key}
                    type="button"
                    aria-label={readout(bucket)}
                    aria-pressed={selected === bucket.key}
                    data-testid="kcal-bar"
                    onClick={() => setSelected(selected === bucket.key ? null : bucket.key)}
                    // the whole slot is the hit target (bigger than the bar), with a 1px gap each side
                    className="group flex h-full min-w-0 flex-1 items-end justify-center px-px outline-none"
                  >
                    {kcal > 0 && (
                      <span
                        className={cn(
                          "w-full max-w-6 rounded-t-xs transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                          "bg-primary",
                          selected !== null && selected !== bucket.key && "opacity-50",
                        )}
                        style={{ height: `${Math.max((kcal / top) * 100, 2)}%` }}
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
    </figure>
  );
}
