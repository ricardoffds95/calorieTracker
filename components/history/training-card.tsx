import Link from "next/link";
import { Check } from "lucide-react";
import { DeltaChip } from "@/components/history/delta-chip";
import { axisLabel, bucketHref, bucketLabel, type PeriodKind, type TrainingBucket, type TrainingSummary } from "@/lib/history";
import { cn } from "@/lib/utils";

interface TrainingCardProps {
  summary: TrainingSummary;
  buckets: readonly TrainingBucket[];
  kind: PeriodKind;
  now: Date;
  /** The change of the number of trainings against the period before; null when there is nothing to compare. */
  delta: number | null;
  todayKey: string;
}

/** The trainings of the period: how many, and a check on every day (or a bar for every week or month) they were done. */
export function TrainingCard({ summary, buckets, kind, now, delta, todayKey }: TrainingCardProps) {
  const { trainings, days } = summary;
  return (
    <section aria-label="Training" data-testid="training-card" className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-muted-foreground">Training</h2>
      {trainings === 0 ? (
        <p data-testid="training-empty" className="text-lg font-semibold">
          No training
        </p>
      ) : (
        <>
          <div>
            <p className="flex items-baseline gap-2">
              <span data-testid="training-total" className="text-5xl font-semibold tracking-tight tabular-nums">
                {trainings}
              </span>
              <span className="text-base text-muted-foreground">{trainings === 1 ? "training" : "trainings"}</span>
            </p>
            <p data-testid="training-days-count" className="text-sm text-muted-foreground tabular-nums">
              on {days} {days === 1 ? "day" : "days"}
            </p>
          </div>
          {delta !== null && (
            <div>
              <DeltaChip percent={delta} kind={kind} />
            </div>
          )}
          {buckets[0]?.granularity === "day" ? <DayChecks buckets={buckets} now={now} todayKey={todayKey} kind={kind} /> : <BucketBars buckets={buckets} now={now} kind={kind} />}
        </>
      )}
    </section>
  );
}

/** One circle per day: filled with a check when there was a training, an outline for today while it is still to do. */
function DayChecks({ buckets, now, todayKey, kind }: { buckets: readonly TrainingBucket[]; now: Date; todayKey: string; kind: PeriodKind }) {
  const small = buckets.length > 7;
  return (
    <ol aria-label="Days trained" data-testid="training-days" className="grid grid-cols-7 gap-y-2">
      {buckets.map((bucket, index) => {
        const pending = !bucket.trained && bucket.from === todayKey;
        return (
          <li key={bucket.key} data-trained={bucket.trained} className="flex justify-center">
            <Link href={bucketHref(bucket, now)} aria-label={`${bucketLabel(bucket)}: ${bucket.trained ? (bucket.count === 1 ? "trained" : `${bucket.count} trainings`) : pending ? "not yet" : "no training"}`} className="flex flex-col items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span
                aria-hidden
                className={cn(
                  "flex items-center justify-center rounded-full",
                  small ? "size-7" : "size-9",
                  bucket.trained ? "bg-primary text-primary-foreground" : pending ? "border-2 border-primary" : "bg-muted",
                )}
              >
                {bucket.trained && <Check className={small ? "size-4" : "size-5"} />}
              </span>
              <span aria-hidden className="text-xs text-muted-foreground tabular-nums">
                {small ? Number(bucket.from.slice(8)) : axisLabel(bucket, index, buckets.length, kind)}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** For a long period: a small bar for every week or month, with how many trainings it holds. */
function BucketBars({ buckets, now, kind }: { buckets: readonly TrainingBucket[]; now: Date; kind: PeriodKind }) {
  const top = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <ol aria-label="Trainings per period" data-testid="training-bars" className="flex h-24 items-end gap-1">
      {buckets.map((bucket, index) => (
        <li key={bucket.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
          <Link href={bucketHref(bucket, now)} aria-label={`${bucketLabel(bucket)}: ${bucket.count} ${bucket.count === 1 ? "training" : "trainings"}`} className="flex h-full flex-col items-center justify-end gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span aria-hidden className="text-xs text-muted-foreground tabular-nums">
              {bucket.count > 0 ? bucket.count : ""}
            </span>
            <span aria-hidden className={cn("w-full max-w-6 rounded-t-sm", bucket.trained ? "bg-primary" : "bg-muted")} style={{ height: `${bucket.trained ? Math.max(8, (bucket.count / top) * 56) : 4}px` }} />
            <span aria-hidden className="h-4 text-xs text-muted-foreground">
              {axisLabel(bucket, index, buckets.length, kind)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
