"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { CustomRangeForm } from "@/components/history/custom-range-form";
import { GoToDateDialog } from "@/components/history/go-to-date-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { toDateKey } from "@/lib/dates";
import { containsDay, periodFor, periodHref, periodLabel, shiftPeriod, type Period, type PeriodKind } from "@/lib/history";
import { cn } from "@/lib/utils";

const KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: "week", label: "Semana" },
  { kind: "month", label: "Mês" },
  { kind: "year", label: "Ano" },
  { kind: "custom", label: "Intervalo" },
];

export function PeriodPicker({ period, now }: { period: Period; now: Date }) {
  const [goTo, setGoTo] = useState(false);
  const today = toDateKey(now);
  const anchor = containsDay(period, today) ? today : period.from;
  const arrow = cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11");
  const atCurrent = period.kind !== "custom" && containsDay(period, today);

  function hrefFor(kind: PeriodKind) {
    return periodHref(kind === "custom" ? { kind, from: period.from, to: period.to } : periodFor(kind, anchor), now);
  }

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Tipo de período" className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1">
        {KINDS.map(({ kind, label }) => (
          <Link
            key={kind}
            href={hrefFor(kind)}
            replace
            aria-current={period.kind === kind ? "true" : undefined}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-10 px-1 text-muted-foreground aria-[current=true]:bg-card aria-[current=true]:text-foreground dark:aria-[current=true]:bg-background",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-1">
        <Link href={periodHref(shiftPeriod(period, -1), now)} aria-label="Período anterior" className={arrow}>
          <ChevronLeft aria-hidden />
        </Link>
        <Button
          type="button"
          variant="ghost"
          className="h-11 min-w-0 flex-1 gap-2 text-lg font-semibold disabled:opacity-100"
          aria-label={`Período: ${periodLabel(period, now)}. Ir para uma data`}
          onClick={() => setGoTo(true)}
          disabled={period.kind === "custom"}
        >
          <span data-testid="period-label" className="block truncate first-letter:uppercase">
            {periodLabel(period, now)}
          </span>
          {period.kind !== "custom" && <CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
        </Button>
        <Link href={periodHref(shiftPeriod(period, 1), now)} aria-label="Período seguinte" className={arrow}>
          <ChevronRight aria-hidden />
        </Link>
      </div>

      {period.kind !== "custom" && !atCurrent && (
        <Link href={periodHref(periodFor(period.kind, today), now)} className={cn(buttonVariants({ variant: "link" }), "h-11 self-center")}>
          Voltar a hoje
        </Link>
      )}

      {period.kind === "custom" && <CustomRangeForm key={`${period.from}-${period.to}`} period={period} now={now} />}
      {goTo && <GoToDateDialog period={period} now={now} onClose={() => setGoTo(false)} />}
    </div>
  );
}
