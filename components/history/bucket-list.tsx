"use client";

import { useState } from "react";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bucketHref, bucketLabel, type Bucket, type Granularity } from "@/lib/history";

const NOUN: Record<Granularity, string> = { day: "days", week: "weeks", month: "months" };

/** The table view of the charts: every bar with its values and a link to open that day (or drill into that week/month). */
export function BucketList({ buckets, now, trainedDays }: { buckets: readonly Bucket[]; now: Date; trainedDays?: ReadonlySet<string> }) {
  const [showAll, setShowAll] = useState(false);
  const noun = NOUN[buckets[0]?.granularity ?? "day"];
  const withData = buckets.filter((bucket) => bucket.average !== null);
  const shown = showAll ? buckets : withData;

  return (
    <section aria-label="Period detail" className="flex flex-col">
      {withData.length < buckets.length && (
        <div className="flex justify-end pb-1">
          <Button type="button" variant="ghost" className="h-11 px-2 text-sm" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>
            {showAll ? `Logged ${noun} only` : `Show all ${noun}`}
          </Button>
        </div>
      )}
      <ul data-testid="bucket-list">
        {shown.map((bucket) => (
          <li key={bucket.key} className="border-t border-border">
            <Link href={bucketHref(bucket, now)} className="flex min-h-14 items-center justify-between gap-3 rounded-sm px-1 py-2">
              <span className="min-w-0">
                <span className="block truncate first-letter:uppercase">{bucketLabel(bucket)}</span>
                {bucket.average && (
                  <span className="block truncate text-xs text-muted-foreground tabular-nums">
                    P {bucket.average.protein} · C {bucket.average.carbs} · F {bucket.average.fat}
                    {bucket.granularity !== "day" && ` · ${bucket.loggedDays} ${bucket.loggedDays === 1 ? "day" : "days"}`}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {bucket.granularity === "day" && trainedDays?.has(bucket.from) && (
                  <span data-testid="trained-mark" role="img" aria-label="Trained" className="flex items-center gap-0.5 text-primary">
                    <Dumbbell aria-hidden className="size-4" />
                  </span>
                )}
                <span className={bucket.average ? "tabular-nums" : "text-muted-foreground"}>{bucket.average ? `${bucket.average.calories} kcal` : "—"}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
