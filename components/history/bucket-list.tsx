import Link from "next/link";
import { bucketHref, bucketLabel, type Bucket } from "@/lib/history";

/** The table view of the chart: every bar with its values, and a link to open that day (or drill into that week/month). */
export function BucketList({ buckets, now }: { buckets: readonly Bucket[]; now: Date }) {
  return (
    <section aria-label="Detalhe do período" className="flex flex-col">
      <ul data-testid="bucket-list">
        {buckets.map((bucket) => (
          <li key={bucket.key} className="border-t border-border">
            <Link href={bucketHref(bucket, now)} className="flex min-h-14 items-center justify-between gap-3 rounded-sm px-1 py-2">
              <span className="min-w-0">
                <span className="block truncate first-letter:uppercase">{bucketLabel(bucket)}</span>
                {bucket.average && (
                  <span className="block truncate text-xs text-muted-foreground tabular-nums">
                    P {bucket.average.protein} · H {bucket.average.carbs} · G {bucket.average.fat}
                    {bucket.granularity !== "day" && ` · ${bucket.loggedDays} ${bucket.loggedDays === 1 ? "dia" : "dias"}`}
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
