"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { bucketHref, bucketLabel, type Bucket, type Granularity } from "@/lib/history";

const NOUN: Record<Granularity, string> = { day: "days", week: "weeks", month: "months" };

/** The table view of the charts: every bar with its values and a link to open that day (or drill into that week/month). */
export function BucketList({ buckets, now }: { buckets: readonly Bucket[]; now: Date }) {
  const [showAll, setShowAll] = useState(false);
  const noun = NOUN[buckets[0]?.granularity ?? "day"];
  const withData = buckets.filter((bucket) => bucket.average !== null);
  const shown = showAll ? buckets : withData;

  return (
    <section aria-label="Period detail" className="flex flex-col">
      <div className="flex items-center justify-between gap-3 pb-1">
        <h2 className="text-base font-semibold">Detalhe</h2>
        {withData.length < buckets.length && (
          <Button type="button" variant="ghost" className="h-11 px-2 text-sm" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>
            {showAll ? `Logged ${noun} only` : `Show all ${noun}`}
          </Button>
        )}
      </div>
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
              <span className={bucket.average ? "shrink-0 tabular-nums" : "shrink-0 text-muted-foreground"}>
                {bucket.average ? `${bucket.average.calories} kcal` : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
