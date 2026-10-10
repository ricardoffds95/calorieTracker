import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { addDays, formatDayLabel, isToday } from "@/lib/dates";
import { cn } from "@/lib/utils";

function dayHref(key: string, now: Date) {
  return isToday(key, now) ? "/" : `/?d=${key}`;
}

export function DayNav({ dateKey, now }: { dateKey: string; now: Date }) {
  const linkClass = cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11");
  return (
    <nav aria-label="Dia" className="flex items-center justify-between">
      <Link href={dayHref(addDays(dateKey, -1), now)} aria-label="Dia anterior" className={linkClass}>
        <ChevronLeft aria-hidden />
      </Link>
      <h1 data-testid="day-label" className="text-lg font-semibold">
        {formatDayLabel(dateKey, now)}
      </h1>
      <Link href={dayHref(addDays(dateKey, 1), now)} aria-label="Dia seguinte" className={linkClass}>
        <ChevronRight aria-hidden />
      </Link>
    </nav>
  );
}
