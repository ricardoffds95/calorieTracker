import type { PeriodSummary } from "@/lib/history";


export function PeriodSummaryCard({ summary }: { summary: PeriodSummary }) {
  const { average, loggedDays, elapsedDays, total } = summary;
  if (!average) {
    return (
      <section aria-label="Period summary" className="flex flex-col gap-1">
        <p data-testid="history-empty" className="text-lg font-semibold">
          Nothing logged
        </p>
        <p className="text-sm text-muted-foreground">{elapsedDays === 0 ? "Not started" : ""}</p>
      </section>
    );
  }
  return (
    <section aria-label="Period summary" className="flex flex-col gap-3">
      <div>
        <p data-testid="avg-kcal" className="text-6xl font-semibold tracking-tight tabular-nums">
          {average.calories}
        </p>
        <p className="text-base text-muted-foreground">kcal per logged day</p>
      </div>
      <p data-testid="logged-days" className="text-sm tabular-nums">
        {loggedDays} of {elapsedDays} {elapsedDays === 1 ? "day logged" : "days logged"}
        <span className="text-muted-foreground"> · total {total.calories} kcal</span>
      </p>
    </section>
  );
}
