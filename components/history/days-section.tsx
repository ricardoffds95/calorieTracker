"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BucketList } from "@/components/history/bucket-list";
import type { Bucket } from "@/lib/history";
import { cn } from "@/lib/utils";

/** The day-by-day list, closed until asked for (it is the longest part of the page). */
export function DaysSection({ buckets, now }: { buckets: readonly Bucket[]; now: Date }) {
  const [open, setOpen] = useState(false);
  const logged = buckets.filter((b) => b.average !== null).length;
  const noun = buckets[0]?.granularity === "month" ? "months" : buckets[0]?.granularity === "week" ? "weeks" : "days";

  return (
    <section aria-label="Days" className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="days-list"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border px-4 text-left"
      >
        <span className="font-medium">
          {open ? "Hide" : "Show"} {noun} <span className="text-muted-foreground tabular-nums">· {logged}</span>
        </span>
        <ChevronDown aria-hidden className={cn("size-5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id="days-list">
          <BucketList buckets={buckets} now={now} />
        </div>
      )}
    </section>
  );
}
